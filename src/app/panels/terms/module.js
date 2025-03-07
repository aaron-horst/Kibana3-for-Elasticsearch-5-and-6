/** @scratch /panels/5
 *
 * include::panels/terms.asciidoc[]
 */

/** @scratch /panels/terms/0
 *
 * == terms
 * Status: *Stable*
 *
 * A table, bar chart or pie chart based on the results of an Elasticsearch terms aggregation.
 *
 */
define([
  'angular',
  'app',
  'lodash',
  'jquery',
  'kbn',
  'config',
],
function (angular, app, _, $, kbn, config) {
  'use strict';

  var module = angular.module('kibana.panels.terms', []);
  app.useModule(module);

  module.controller('terms', function($scope, querySrv, dashboard, filterSrv, fields) {
    $scope.panelMeta = {
      modals : [
        {
          description: "Inspect",
          icon: "icon-info-sign",
          partial: "app/partials/inspector.html",
          show: $scope.panel.spyable
        }
      ],
      editorTabs : [
        {title:'Queries', src:'app/partials/querySelect.html'}
      ],
      status  : "Stable",
      description : "Displays the results of popular terms on your selected field as a pie " +
        "chart, bar chart, or a table format.<br>"
    };

    // Set and populate defaults
    var _d = {
      /** @scratch /panels/terms/5
       * === Parameters
       *
       * field:: The field on which to compute the aggregation
       */
      field   : '_index',
      /**
       * 
       * alternate field to aggregate upon for 'unique' filtering
       */
      value_field: '',
      /** @scratch /panels/terms/5
       * exclude:: terms to exclude from the results
       */
      exclude : [],
      /** @scratch /panels/terms/5
       * missing:: Set to false to disable the display of a counter showing how much results are
       * missing the field
       */
      missing : true,
      /** @scratch /panels/terms/5
       * other:: Set to false to disable the display of a counter representing the aggregate of all
       * values outside of the scope of your +size+ property
       */
      other   : true,
      /** @scratch /panels/terms/5
       * size:: Show this many terms
       */
      size    : 10,
      /** @scratch /panels/terms/5
       * order:: In terms mode: count, term, reverse_count or reverse_term,
       * in terms_stats mode: term, reverse_term, count, reverse_count,
       * total, reverse_total, min, reverse_min, max, reverse_max, mean or reverse_mean
       */
      order   : 'count',
      style   : { "font-size": '10pt'},
      /** @scratch /panels/terms/5
       * donut:: In pie chart mode, draw a hole in the middle of the pie to make a tasty donut.
       */
      donut   : false,
      /** @scratch /panels/terms/5
       * tilt:: In pie chart mode, tilt the chart back to appear as more of an oval shape
       */
      tilt    : false,
      /** @scratch /panels/terms/5
       * lables:: In pie chart mode, draw labels in the pie slices
       */
      labels  : true,
      /** @scratch /panels/terms/5
       * arrangement:: In bar or pie mode, arrangement of the legend. horizontal or vertical
       */
      arrangement : 'horizontal',
      /** @scratch /panels/terms/5
       * chart:: table, bar or pie
       */
      chart       : 'bar',
      /** @scratch /panels/terms/5
       * counter_pos:: The location of the legend in respect to the chart, above, below, or none.
       */
      counter_pos : 'above',
      /** @scratch /panels/terms/5
       * spyable:: Set spyable to false to disable the inspect button
       */
      spyable     : true,
      /** @scratch /panels/terms/5
       *
       * ==== Queries
       * queries object:: This object describes the queries to use on this panel.
       * queries.mode::: Of the queries available, which to use. Options: +all, pinned, unpinned, selected+
       * queries.ids::: In +selected+ mode, which query ids are selected.
       */
      queries     : {
        mode        : 'all',
        ids         : []
      },
      /** @scratch /panels/terms/5
       * multiterms:: Multi terms: used to either filterSrv
       */
      multiterms  : [],
      
      tmode       : 'terms',
      /** @scratch /panels/terms/5
       * tstat:: Terms_stats aggregation stats field
       */
      tstat       : 'total',
      /** @scratch /panels/terms/5
       * valuefield:: Terms_stats aggregation value field
       */
      valuefield  : '',
      description : '',
      descriptionLocation : 'Top',
      descriptionUrl  : '',
    };

    _.defaults($scope.panel,_d);

    $scope.init = function () {
      $scope.hits = 0;

      $scope.$on('refresh',function(){
        $scope.get_data();
      });
      $scope.get_data();

    };

    $scope.get_data = function() {
      // Make sure we have everything for the request to complete
      if(dashboard.indices.length === 0) {
        return;
      }

      $scope.panelMeta.loading = true;
      var request,
        results,
        boolQuery,
        queries;

      $scope.field = _.contains(fields.list,$scope.panel.field+'.raw') ?
        $scope.panel.field+'.raw' : $scope.panel.field;

      request = $scope.ejs.Request();

      $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);
      queries = querySrv.getQueryObjs($scope.panel.queries.ids);

      // Construct base bool query 
      boolQuery = filterSrv.getBoolQuery(filterSrv.ids());
      var _b = $scope.ejs.BoolQuery();
      _.each(queries,function(q) {
        _b = _b.should(querySrv.toEjsObj(q));
      });
      boolQuery = boolQuery.must(_b);
      var query = boolQuery;

      // Terms mode
      if($scope.panel.tmode === 'terms') {
        var termsAggs = $scope.ejs.TermsAggregation('terms')
          .field($scope.field)
          .size($scope.panel.size)
          .exclude($scope.panel.exclude);
        switch($scope.panel.order) {
        case 'term':
          termsAggs.order('_term','asc');
          break;
        case 'count':
          termsAggs.order('_count');
          break;
        case 'reverse_count':
          termsAggs.order('_count','asc');
          break;
        case 'reverse_term':
          termsAggs.order('_term');
          break;
        default:
          termsAggs.order('_count');
        }
        request = request.query(query).agg(termsAggs).size(0);

        // add exists agg if requested
        if ($scope.panel.missing) {
          var missingAggs = $scope.ejs.MissingAggregation('missing')
            .field($scope.panel.field);

          request = request.agg(missingAggs);
        }
      }
      else if($scope.panel.tmode === 'terms_stats') {
        var terms_aggs = $scope.ejs.TermsAggregation('terms')
          .field($scope.panel.field)
          .size($scope.panel.size);

        var sub_aggs = $scope.ejs.StatsAggregation('subaggs')
            .field($scope.panel.valuefield);

        switch($scope.panel.order) {
        case 'term':
          terms_aggs.order('_term','asc');
          break;
        case 'reverse_term':
          terms_aggs.order('_term','desc');
          break;
        case 'count':
          terms_aggs.order('_count','desc');
          break;
        case 'reverse_count':
          terms_aggs.order('_count','asc');
          break;
        case 'total':
          terms_aggs.order('subaggs.sum','desc');
          break;
        case 'reverse_total':
          terms_aggs.order('subaggs.sum','asc');
          break;
        case 'min':
          terms_aggs.order('subaggs.min','desc');
          break;
        case 'reverse_min':
          terms_aggs.order('subterms.min','asc');
          break;
        case 'max':
          terms_aggs.order('subaggs.max','desc');
          break;
        case 'reverse_max':
          terms_aggs.order('subaggs.max','asc');
          break;
        case 'mean':
          terms_aggs.order('subaggs.avg','desc');
          break;
        case 'reverse_mean':
          terms_aggs.order('subaggs.avg','asc');
          break;
        }
        request = request.query(query)
        .agg(terms_aggs.agg(sub_aggs)).size(0);
      }
      else if($scope.panel.tmode === 'unique') {
        var terms_aggs2 = $scope.ejs.TermsAggregation('terms')
          .field($scope.panel.field)
          .size($scope.panel.size);

        var sub_aggs2 = $scope.ejs.CardinalityAggregation('subaggs')
            .field($scope.panel.value_field);

        switch($scope.panel.order) {
        case 'term':
          terms_aggs2.order('_term','asc');
          break;
        case 'count':
          terms_aggs2.order('_count');
          break;
        case 'reverse_count':
          terms_aggs2.order('_count','asc');
          break;
        case 'reverse_term':
          terms_aggs2.order('_term');
          break;
        default:
          terms_aggs2.order('_count');
        }
        request = request.query(query)
        .agg(terms_aggs2.agg(sub_aggs2)).size(0);
      }

      // Populate the inspector panel
      $scope.inspector = request.toJSON();

      results = $scope.ejs.doSearch(dashboard.indices, request);

      // Populate scope when we have results
      results.then(function(results) {
        $scope.panelMeta.loading = false;
        $scope.hits = results.hits.total;

        $scope.results = results;

        $scope.$emit('render');
      });
    };

    $scope.build_search = function(term, negate, event) {
      console.log('build_search called with:', term, negate, event);

      // Check if the Ctrl key is pressed
      if (event && event.ctrlKey) {
        // Add term to multiterms instead of executing a search
        console.log('Ctrl key pressed. Adding term to multiterms:', term);
        $scope.add_multi_search(term);
        return;
      }

      if(_.isUndefined(term.meta)) {
        var labelValue = angular.toJson(term.label);

        const q = $scope.field + ":(" + labelValue + ")";

        filterSrv.set({
          editing   : false,
          type      : 'querystring',
          query     : q,
          mandate   : (negate ? 'mustNot' : 'must')
        },undefined,false);
      } else if(term.meta === 'missing') {
        filterSrv.set({type:'exists',field:$scope.field,
          mandate:(negate ? 'must':'mustNot')});
      } else {
        return;
      }
    };

    $scope.multi_search = function() {
      if (!Array.isArray($scope.panel.multiterms)) {
        console.error('Input must be an array.');
        return null;
      }
      
      var labelValues = $scope.panel.multiterms.map(obj => {
        // Escape quotes and wrap the label in double quotes
        const escapedLabel = String(obj.label).replace(/"/g, '\\"');
        return `"${escapedLabel}"`;
      })
      .filter(label => label) // Remove any empty strings from invalid entries
      .join(', ');

      const q = $scope.field + ":(" + labelValues + ")";

      filterSrv.set({
        editing   : false,
        type      : 'querystring',
        query     : q,
        mandate   : 'must'
      },undefined,false);

      dashboard.refresh();
      $scope.panel.multiterms.length = 0; // reset
    };

    $scope.getSubmitButtonText = function() {
      return 'Submit ' + $scope.panel.multiterms.length + ' Filters';
    };

    $scope.add_multi_search = function(term) {
      if ($scope.check_multi_search(term)) {
        // exists, so remove
        $scope.delete_multi_search(term);
      } else {
        // add
        $scope.panel.multiterms.push(term);
      }
    };
    $scope.delete_multi_search = function(term) {
      _.remove($scope.panel.multiterms, term);
    };
    $scope.check_multi_search = function(term) {
      return _.indexOf($scope.panel.multiterms, term) >= 0;
    };

    $scope.set_refresh = function (state) {
      $scope.refresh = state;
    };

    $scope.close_edit = function() {
      if($scope.refresh) {
        $scope.get_data();
      }
      $scope.refresh =  false;
      $scope.$emit('render');
    };

    $scope.showMeta = function(term) {
      if(_.isUndefined(term.meta)) {
        return true;
      }
      if(term.meta === 'other' && !$scope.panel.other) {
        return false;
      }
      if(term.meta === 'missing' && !$scope.panel.missing) {
        return false;
      }
      return true;
    };

    $scope.getDynamicUrl = function(field, row) {
      // console.log('Field',field);
      // console.log("Row:", row);

      // Find the hyperlink rules for the given field
      const rules = config.hyperlinked_fields_aggregates.find(hf => hf.fieldName === field);
      if (!rules) {
        return null; // If no rules found, return null
      }
    
      // Extract token values directly from the row object
      const tokens = rules.tokens.map(token => row[token] || ''); // Use the token as the key
    
      // Replace the {0}, {1}, etc., in the URL template with token values
      const newUrl = rules.urlTemplate.replace(/{(\d+)}/g, (_, index) => tokens[index] || '');
      return newUrl;
    };
    
    $scope.isLinkable = function(field, termLabel) {
      if (termLabel === undefined || termLabel === 'Other values' || termLabel === 'Missing field') {
        return false; // special slices we want to ignore
      }

      // var retval = config.hyperlinked_fields_doclevel.some(hf => hf.fieldName === field);
      const rules = config.hyperlinked_fields_aggregates.find(hf => hf.fieldName === field);
      if (!rules) {
        return false; // If no rules found, return null
      }

      return true;
    };

    // note this currently DOESNT WORK well, never figured out...
    $scope.getDynamicUrlFriendlyName = function(field) {
      // Find the hyperlink rules for the given field
      const rules = config.hyperlinked_fields_aggregates.find(hf => hf.fieldName === field);
      if (!rules) {
        return null; // If no rules found, return null
      }

      const url = rules.urlTemplate;

      try {
        const parsedUrl = new URL(url); // Parse the URL
        return `${parsedUrl.protocol}//${parsedUrl.hostname}`; // Construct the base URL
      } catch (error) {
        console.error('Invalid URL:', url, error);
        return "error"; // Return null if the URL is invalid
      }
    };

    $scope.getRowData = function(panel, termObj) {
      return { [panel.field]: termObj.label }; // Dynamically create the row object
    };

  });

  module.directive('termsChart', function(querySrv) {
    return {
      restrict: 'A',
      link: function(scope, elem) {
        var plot;

        // Receive render events
        scope.$on('render',function(){
          render_panel();
        });

        function build_results() {
          //forward_compatible_map
          var _fcm = {
            "sum":"sum",
            "total":"sum",
            "mean":"avg",
            "avg":"avg",
            "min":"min",
            "max":"max",
            "count":"count",
          };
          var k = 0;
          var addSlice = true;

          scope.data = [];
          _.each(scope.results.aggregations.terms.buckets, function(v) {
            var slice;
            //if the value is 1/0 but is meant to be true/false, update the key value
            if (v.key_as_string !== undefined) {
              v.key = v.key_as_string;
            }
            if(scope.panel.tmode === 'terms') {
              slice = { label : v.key, data : [[k,v.doc_count]], actions: true};
            }
            if(scope.panel.tmode === 'terms_stats') {
              slice = {
                label : v.key,
                data : [[k,v['subaggs'][_fcm[scope.panel.tstat]]]],
                actions: true
              };
            }
            if(scope.panel.tmode === 'unique') {
              if (v['subaggs'] === undefined) {
                addSlice = false;
              }
              else {
                addSlice = true;
                slice = {
                  label : v.key,
                  data : [[k,v['subaggs']['value']]],
                  actions: true
                };
              }
            }
            
            if (addSlice) {
              
              scope.data.push(slice);
              k = k + 1;
            }
          });

          if (scope.panel.tmode === 'terms') {
            scope.data.push({
              label: 'Other values',
              data: [[k + 1, scope.results.aggregations.terms.sum_other_doc_count]],
              meta: "other",
              color: '#444'
            });

            // wireup missing terms data
            if (scope.panel.missing) {
              scope.data.push({
                label: 'Missing field',
                data: [[k + 2, scope.results.aggregations.missing.doc_count, 'unknown']],
                meta: "missing",
                color: '#aaa',
                opacity: 0
              });
            }
          }
        }

        // Function for rendering panel
        function render_panel() {
          var chartData;

          build_results();

          // IE doesn't work without this
          elem.css({height:scope.panel.height||scope.row.height});

          // Make a clone we can operate on.
          chartData = _.clone(scope.data);
          chartData = scope.panel.missing ? chartData :
            _.without(chartData,_.findWhere(chartData,{meta:'missing'}));
          chartData = scope.panel.other ? chartData :
          _.without(chartData,_.findWhere(chartData,{meta:'other'}));

          if (chartData === undefined) {
            return;
          }

          // Populate element.
          require(['jquery.flot.pie'], function(){
            // Populate element
            try {
              // Add plot to scope so we can build out own legend
              if(scope.panel.chart === 'bar') {
                plot = $.plot(elem, chartData, {
                  legend: { show: false },
                  series: {
                    lines:  { show: false, },
                    bars:   { show: true,  fill: 1, barWidth: 0.8, horizontal: false },
                    shadowSize: 1
                  },
                  yaxis: { show: true, min: 0, color: "#c8c8c8" },
                  xaxis: { show: false },
                  grid: {
                    borderWidth: 0,
                    borderColor: '#c8c8c8',
                    color: "#c8c8c8",
                    hoverable: true,
                    clickable: true
                  },
                  colors: querySrv.colors
                });
              }
              if(scope.panel.chart === 'pie') {
                var labelFormat = function(label, series){
                  var safeLabel = String(label).replace(/'/g, "\\'").replace(/"/g, '&quot;');

                  return '<div ng-click="build_search(panel.field,\''+ safeLabel +'\')'+
                    ' "style="font-size:8pt;text-align:center;padding:2px;color:white;">'+
                    safeLabel +'<br/>'+Math.round(series.percent)+'%</div>';
                };

                plot = $.plot(elem, chartData, {
                  legend: { show: false },
                  series: {
                    pie: {
                      innerRadius: scope.panel.donut ? 0.4 : 0,
                      tilt: scope.panel.tilt ? 0.45 : 1,
                      radius: 1,
                      show: true,
                      combine: {
                        color: '#999',
                        label: 'The Rest'
                      },
                      stroke: {
                        width: 0
                      },
                      label: {
                        show: scope.panel.labels,
                        radius: 2/3,
                        formatter: labelFormat,
                        threshold: 0.1
                      }
                    }
                  },
                  //grid: { hoverable: true, clickable: true },
                  grid:   { hoverable: true, clickable: true, color: '#c8c8c8' },
                  colors: querySrv.colors
                });
              }

              // Populate legend
              if(elem.is(":visible")){
                setTimeout(function(){
                  scope.legend = plot.getData();
                  if(!scope.$$phase) {
                    scope.$apply();
                  }
                });
              }

            } catch(e) {
              elem.text(e);
            }
          });
        }

        elem.bind("plotclick", function (event, pos, object) {
          // if(object) {
          //   scope.build_search(scope.data[object.seriesIndex],false,event);
          // }

          if (object) {
            // Check if the Ctrl key is pressed
            const isCtrlPressed = window.event && window.event.ctrlKey;
            if (isCtrlPressed) {
              console.log('Ctrl+Click detected on Flot chart item:', object);
              scope.add_multi_search(scope.data[object.seriesIndex]);
              scope.$apply(); // Ensure Angular detects the changes
            } else {
              console.log('Regular click detected on Flot chart item:', scope.data[object.seriesIndex]);
              scope.build_search(scope.data[object.seriesIndex]),false,event;
            }
          }
        });

        var $tooltip = $('<div>');
        elem.bind("plothover", function (event, pos, item) {
          if (item) {
            var value = scope.panel.chart === 'bar' ? item.datapoint[1] : item.datapoint[1][0][1];
            $tooltip
              .html(
                kbn.query_color_dot(item.series.color, 20) + ' ' +
                item.series.label + " (" + value.toFixed(0) +
                (scope.panel.chart === 'pie' ? (", " + Math.round(item.datapoint[0]) + "%") : "") + ")"
              )
              .place_tt(pos.pageX, pos.pageY);
          } else {
            $tooltip.remove();
          }
        });

      }
    };
  });

});
