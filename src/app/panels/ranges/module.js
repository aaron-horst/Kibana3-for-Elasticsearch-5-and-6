/** @scratch /panels/5
 *
 * include::panels/ranges.asciidoc[]
 */

/** @scratch /panels/ranges/0
 *
 * == ranges
 * Status: *Experimental*
 *
 * A table, bar chart or pie chart based on the results of an Elasticsearch ranges aggregation.
 *
 */
define([
  'angular',
  'app',
  'lodash',
  'jquery',
  'kbn'
],
function (angular, app, _, $, kbn) {
  'use strict';

  var module = angular.module('kibana.panels.ranges', []);
  app.useModule(module);

  module.controller('ranges', function($scope, querySrv, dashboard, filterSrv, fields) {
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
      description : "Displays the results of an elasticsearch aggregation " +
      "as a pie chart, bar chart, or a table.<br>" +
      "The filter built from bucket has an issue: " +
      "https://github.com/chenryn/kibana-authorization/issues/23<br>" +
      "filterSvr does not supprt glt tl. I will fix it later."
    };

    // Set and populate defaults
    $scope.defaultValue = {
      'from': 0,
      'to'  : 100
    };

    // Set and populate defaults
    var _d = {
      /** @scratch /panels/ranges/5
      * === Parameters
      *
      * values:: The range values add to the facet
      */
      values  : [angular.copy($scope.defaultValue)],
      /** @scratch /panels/ranges/5
      * === Parameters
      *
      * field:: The field on which to computer the facet
      */
      field   : '_type',
      style   : { "font-size": '10pt'},
      /** @scratch /panels/ranges/5
      * donut:: In pie chart mode, draw a hole in the middle of the pie to make a tasty donut.
      */
      donut   : false,
      /** @scratch /panels/ranges/5
      * tilt:: In pie chart mode, tilt the chart back to appear as more of an oval shape
      */
      tilt    : false,
      /** @scratch /panels/ranges/5
      * lables:: In pie chart mode, draw labels in the pie slices
      */
      labels  : true,
      /** @scratch /panels/ranges/5
      * arrangement:: In bar or pie mode, arrangement of the legend. horizontal or vertical
      */
      arrangement : 'horizontal',
      /** @scratch /panels/ranges/5
      * chart:: table, bar or pie
      */
      chart       : 'bar',
      /** @scratch /panels/ranges/5
      * counter_pos:: The location of the legend in respect to the chart, above, below, or none.
      */
      counter_pos : 'above',
      /** @scratch /panels/ranges/5
      * spyable:: Set spyable to false to disable the inspect button
      */
      spyable     : true,
      /** @scratch /panels/ranges/5
      *
      * ==== Queries
      * queries object:: This object describes the queries to use on this panel.
      * queries.mode::: Of the queries available, which to use. Options: +all, pinned, unpinned, selected+
      * queries.ids::: In +selected+ mode, which query ids are selected.
      */
      queries     : {
        mode        : 'all',
        ids         : []
      }
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
      rangeAgg,
      results,
      boolQuery,
      queries;

      $scope.field = _.contains(fields.list,$scope.panel.field+'.raw') ?
      $scope.panel.field+'.raw' : $scope.panel.field;

      request = $scope.ejs.Request();

      $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);
      queries = querySrv.getQueryObjs($scope.panel.queries.ids);

      // This could probably be changed to a BoolFilter
      boolQuery = $scope.ejs.BoolQuery();
      _.each(queries,function(q) {
        boolQuery = boolQuery.should(querySrv.toEjsObj(q));
      });
      var query = $scope.ejs.FilteredQuery(
        boolQuery,
        filterSrv.getBoolFilter(filterSrv.ids())
      );

      request = request.query(query);

      rangeAgg = $scope.ejs.RangeAggregation('ranges');
      // AddRange
      _.each($scope.panel.values, function(v) {
        rangeAgg.range(v.from, v.to);
      });

      request = request.agg(
        rangeAgg.field($scope.field)
      ).size(0);

      // Populate the inspector panel
      $scope.inspector = request.toJSON();

      results = $scope.ejs.doSearch(dashboard.indices, request);

      // Populate scope when we have results
      results.then(function(results) {
        $scope.panelMeta.loading = false;
        if($scope.panel.tmode === 'ranges') {
          $scope.hits = results.hits.total;
        }

        $scope.results = results;

        $scope.$emit('render');
      });
    };

    $scope.build_search = function(range,negate) {
      if(_.isUndefined(range.meta)) {
        // TODO https://github.com/chenryn/kibana-authorization/issues/23
        filterSrv.set({type:'range',field:$scope.field,from:range.from,to:range.to,
        mandate:(negate ? 'mustNot':'must')});
      } else if(range.meta === 'missing') {
        filterSrv.set({type:'exists',field:$scope.field,
        mandate:(negate ? 'must':'mustNot')});
      } else {
        return;
      }
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

    $scope.showMeta = function(range) {
      if(_.isUndefined(range.meta)) {
        return true;
      }
      return true;
    };

    $scope.add_new_value = function(panel) {
      panel.values.push(angular.copy($scope.defaultValue));
    };

  });

  module.directive('rangesChart', function(querySrv) {
    return {
      restrict: 'A',
      link: function(scope, elem) {
        var plot;

        // Receive render events
        scope.$on('render',function(){
          render_panel();
        });

        function build_results() {
          var k = 0;
          scope.data = [];
          _.each(scope.results.aggregations.ranges.buckets, function(v) {
            var slice = { from:v.from, to:v.to, label : v.key, data : [[k,v.doc_count]], actions: true};
            scope.data.push(slice);
            k = k + 1;
          });
        }

        // Function for rendering panel
        function render_panel() {
          var chartData;

          build_results();

          // IE doesn't work without this
          elem.css({height:scope.panel.height||scope.row.height});

          // Make a clone we can operate on.
          chartData = _.clone(scope.data);

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
                  return '<div ng-click="build_search(panel.field,\''+label+'\')'+
                  ' "style="font-size:8pt;text-align:center;padding:2px;color:white;">'+
                  label+'<br/>'+Math.round(series.percent)+'%</div>';
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
          if(object) {
            scope.build_search(scope.data[object.seriesIndex]);
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
