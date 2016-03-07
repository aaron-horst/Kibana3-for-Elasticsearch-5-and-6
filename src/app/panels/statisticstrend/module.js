/** @scratch /panels/statisticstrend/0
 * == statisticstrend
 * Status: *Testing*
 *
 * A table, bar chart or table chart based on the results of an Elasticsearch terms facet.
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

  var module = angular.module('kibana.panels.statisticstrend', []);
  app.useModule(module);

  module.controller('statisticstrend', function($scope, kbnIndex, querySrv, dashboard, filterSrv, fields) {
    $scope.inspector = "";
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
      status  : "stable",
      description : "上升趋势." +
      "不一定准确,取决于trysize. trysize设置为0,可以获取所有terms,"+
      "结果准确, 但需要考虑资源消耗情况."
    };

    // Set and populate defaults
    var _d = {
      /**
       * === Parameters
       *
       * field:: The field on which to computer the facet
       */
      mode          : 'count',
      field   : '_type',
      /**
       * exclude:: terms to exclude from the results
       */
      missing : true,
      /**
       * other:: Set to false to disable the display of a counter representing the aggregate of all
       * values outside of the scope of your +size+ property
       */
      other   : true,
      /**
       * size:: Show this many terms
       */
      size    : 10,
      /**
       * order:: count, term, reverse_count or reverse_term
       */
      order   : 'asce',
      style   : { "font-size": '10pt'},
      /**
       * counter_pos:: above, below or none
       */
      counter_pos       : 'above',
      /**
       * arrangement:: Arrangement of the legend. horizontal or vertical
       */
      arrangement : 'horizontal',
      /**
       * chart:: table, bar
       */
      chart       : 'bar',
      /**
       * spyable:: Set spyable to false to disable the inspect button
       */
      spyable     : true,
      /** @scratch /panels/statisticstrend/5
       * ==== Queries
       * queries object:: This object describes the queries to use on this panel.
       * queries.mode::: Of the queries available, which to use. Options: +all, pinned, unpinned, selected+
       * queries.ids::: In +selected+ mode, which query ids are selected.
       */
      queries     : {
        mode        : 'all',
        ids         : []
      },
    };
    _.defaults($scope.panel,_d);

    $scope.init = function () {
      $scope.hits = 0;

      $scope.$on('refresh',function(){
        $scope.get_data();
      });
      $scope.get_data();

    };

    $scope.set_refresh = function (state) {
      $scope.refresh = state;
    };

    $scope.get_data = function(firstTime) {
      // Make sure we have everything for the request to complete
      if(dashboard.indices.length === 0) {
        return;
      }

      if (firstTime === undefined){
          // This logic can be simplifie greatly with the new kbn.parseDate
          $scope.time = filterSrv.timeRange('last');
          $scope.old_time = {
            from : new Date($scope.time.from.getTime() - kbn.interval_to_ms($scope.panel.ago)),
            to   : new Date($scope.time.to.getTime() - kbn.interval_to_ms($scope.panel.ago))
          };

          $scope.index = dashboard.indices;
          kbnIndex.indices(
            $scope.old_time.from,
            $scope.old_time.to,
            dashboard.current.index.pattern,
            dashboard.current.index.interval
          ).then(function (p) {
            $scope.index = _.union(p,$scope.index);
            $scope.get_data(true);
          });
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

      // This could probably be changed to a BoolFilter
      boolQuery = $scope.ejs.BoolQuery();
      _.each(queries,function(q) {
        boolQuery = boolQuery.should(querySrv.toEjsObj(q));
      });
      request = request.query(boolQuery);

      if(_.isNull($scope.panel.value_field)) {
        $scope.panel.error = "In " + $scope.panel.mode + " mode a field must be specified";
        return;
      }

      // Determine a time field
      var timeField = _.uniq(_.pluck(filterSrv.getByType('time'),'field'));
      if(timeField.length > 1) {
        $scope.panel.error = "Time field must be consistent amongst time filters";
        return;
      } else if(timeField.length === 0) {
        $scope.panel.error = "A time filter must exist for this panel to function";
        return;
      } else {
        timeField = timeField[0];
      }

      var filter_aggs =
      $scope.ejs.FilterAggregation('now').filter(filterSrv.getBoolFilter(filterSrv.ids()));

      var _ids_without_time = _.difference(filterSrv.ids(),filterSrv.idsByType('time'));
      var old_filter_aggs =
      $scope.ejs.FilterAggregation('old').filter(
        filterSrv.getBoolFilter(_ids_without_time).must(
          $scope.ejs.RangeFilter(timeField)
          .from($scope.old_time.from)
          .to($scope.old_time.to)
        )
      );

      var terms_aggs = $scope.ejs.TermsAggregation('termsaggs')
      .field($scope.field);
      if ($scope.panel.trysize !== ''){
        terms_aggs.size($scope.panel.trysize);
      }
      if ($scope.panel.trysize !== ''){
        terms_aggs.minDocCount($scope.panel.mincount);
      }

      if ($scope.panel.mode === 'count'){
        request = request
        .agg(filter_aggs.agg(terms_aggs))
        .agg(old_filter_aggs.agg(terms_aggs));
      } else{
        var sub_aggs;
        switch($scope.panel.mode) {
          case 'min':
          sub_aggs = $scope.ejs.MinAggregation('statsaggs')
          .field($scope.panel.value_field);
          break;
          case 'max':
          sub_aggs = $scope.ejs.MaxAggregation('statsaggs')
          .field($scope.panel.value_field);
          break;
          case 'total':
          sub_aggs = $scope.ejs.SumAggregation('statsaggs')
          .field($scope.panel.value_field);
          break;
          case 'mean':
          sub_aggs = $scope.ejs.AvgAggregation('statsaggs')
          .field($scope.panel.value_field);
          break;
        }
        request = request
        .agg(filter_aggs.agg(terms_aggs.agg(sub_aggs)))
        .agg(old_filter_aggs.agg(terms_aggs.agg(sub_aggs)));
      }

      // Populate the inspector panel
      $scope.inspector = request.toJSON();

      results = $scope.ejs.doSearch($scope.index, request);

      // Populate scope when we have results
      results.then(function(results) {
        var all_filed_values = {};
        _.each(results.aggregations.now.termsaggs.buckets,function(v){
          if($scope.panel.mode === 'count'){
            all_filed_values[v.key] = [v.doc_count];
          }else{
            all_filed_values[v.key] = [v.statsaggs.value];
          }
        });
        _.each(results.aggregations.old.termsaggs.buckets,function(v){
          if($scope.panel.mode === 'count'){
            if (v.key in all_filed_values){
              all_filed_values[v.key].push(v.doc_count);
            }
          }else{
            if (v.key in all_filed_values){
              all_filed_values[v.key].push(v.statsaggs.value);
            }
          }
        });

        var l =[];
        for(var term in all_filed_values){
            if (all_filed_values[term].length !== 1 && all_filed_values[term][0]*all_filed_values[term][1]!=0){
                l.push([term].concat(all_filed_values[term]));
            }
        }

        for(var i in l){
            var p = l[i][2] === 0 ? 100 : 100*l[i][1]/l[i][2];
            l[i].push(p);
        }


        if ($scope.panel.order == 'asce')
            l.sort(function(x,y){return x[3]-y[3]});
        else
            l.sort(function(x,y){return y[3]-x[3]});

        l.splice($scope.panel.size);

        $scope.hits = results.hits.total;
        $scope.data = [];

        for(var i in l){
            $scope.data.push({ label : l[i][0], data : [[i,l[i][3].toFixed(2)]], extra:[l[i][1].toFixed(2),l[i][2].toFixed(2)], actions: true});
        }

        $scope.panelMeta.loading = false;

        $scope.$emit('render');
      });
    };

    $scope.build_search = function(term,negate) {
      if(_.isUndefined(term.meta)) {
        filterSrv.set({type:'terms',field:$scope.field,value:term.label,
          mandate:(negate ? 'mustNot':'must')});
      } else if(term.meta === 'missing') {
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

  });

  module.directive('statisticstrendChart', function(querySrv) {
    return {
      restrict: 'A',
      link: function(scope, elem) {

        // Receive render events
        scope.$on('render',function(){
          render_panel();
        });

        // Re-render if the window is resized
        angular.element(window).bind('resize', function(){
          render_panel();
        });

        // Function for rendering panel
        function render_panel() {
          var plot, chartData;

          // IE doesn't work without this
          elem.css({height:scope.panel.height||scope.row.height});

          // Make a clone we can operate on.
          chartData = _.clone(scope.data);
          chartData = scope.panel.missing ? chartData :
          _.without(chartData,_.findWhere(chartData,{meta:'missing'}));
          chartData = scope.panel.other ? chartData :
          _.without(chartData,_.findWhere(chartData,{meta:'other'}));

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
                    borderColor: '#eee',
                    color: "#eee",
                    hoverable: true,
                    clickable: true
                  },
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
                item.series.label + " (" + value.toFixed(0)+")"
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
