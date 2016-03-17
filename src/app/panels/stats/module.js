/*

  ## Stats Module

  ### Parameters
  * format :: The format of the value returned. (Default: number)
  * style :: The font size of the main number to be displayed.
  * mode :: The aggergate value to use for display
  * spyable ::  Dislay the 'eye' icon that show the last elasticsearch query

*/
define([
  'angular',
  'app',
  'lodash',
  'jquery',
  'kbn',
  'numeral'
], function (
  angular,
  app,
  _,
  $,
  kbn,
  numeral
) {

  'use strict';

  var module = angular.module('kibana.panels.stats', []);
  app.useModule(module);

  module.controller('stats', function ($scope, querySrv, dashboard, filterSrv) {

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
      status: 'Beta',
      description: 'A statistical panel for displaying aggregations using the Elastic Search statistical facet query.'
    };

    $scope.modes = ['count','min','max','mean','total','variance','std_deviation','sum_of_squares'];

    var defaults = {
      queries     : {
        mode        : 'all',
        ids         : []
      },
      style   : { "font-size": '24pt'},
      format: 'number',
      mode: '-',
      display_breakdown: 'yes',
      sort_field: '',
      sort_reverse: false,
      label_name: 'Query',
      value_name: 'Value',
      spyable     : true,
      show: {
        count: true,
        min: true,
        max: true,
        mean: true,
        std_deviation: true,
        sum_of_squares: true,
        total: true,
        variance: true
      }
    };

    _.defaults($scope.panel, defaults);

    $scope.init = function () {
      $scope.ready = false;
      $scope.$on('refresh', function () {
        $scope.get_data();
      });
      $scope.get_data();
    };

    $scope.set_sort = function(field) {
      if($scope.panel.sort_field === field && $scope.panel.sort_reverse === false) {
        $scope.panel.sort_reverse = true;
      } else if($scope.panel.sort_field === field && $scope.panel.sort_reverse === true) {
        $scope.panel.sort_field = '';
        $scope.panel.sort_reverse = false;
      } else {
        $scope.panel.sort_field = field;
        $scope.panel.sort_reverse = false;
      }
    };
    $scope.nullsToBottom = function(obj) {
      return (null === obj.value[$scope.panel.sort_field] ? 0 : 1);
    };

    $scope.add_dash_to_modes = function(modes){
      var newmodes = modes.slice();
      newmodes.unshift('-');
      return newmodes;
    }

    $scope.get_data = function () {
      if(dashboard.indices.length === 0) {
        return;
      }

      $scope.panelMeta.loading = true;

      var request,
        results,
        boolQuery,
        queries;

      $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);
      queries = querySrv.getQueryObjs($scope.panel.queries.ids);

      boolQuery = $scope.ejs.BoolQuery();
      _.each(queries,function(q) {
        boolQuery = boolQuery.should(querySrv.toEjsObj(q));
      });

      var query = $scope.ejs.FilteredQuery(
        $scope.ejs.BoolQuery(),
        filterSrv.getBoolFilter(filterSrv.ids())
      );
      request = $scope.ejs.Request().query(query);

      if ($scope.panel.mode !== '-'){
        request = request
        .agg($scope.ejs.FilterAggregation('stats')
        .filter($scope.ejs.QueryFilter(
            boolQuery
          )).agg($scope.ejs.ExtendedStatsAggregation("0").field($scope.panel.field))
        );
      }


      _.each(queries, function (q) {
        var alias = q.alias || q.query;
        request.agg($scope.ejs.FilterAggregation('stats_'+alias)
          .filter($scope.ejs.QueryFilter(querySrv.toEjsObj(q)))
          .agg($scope.ejs.ExtendedStatsAggregation("0").field($scope.panel.field))
        );
      });

      // Populate the inspector panel
      $scope.inspector = request.toJSON();

      results = $scope.ejs.doSearch(dashboard.indices, request);

      results.then(function(results) {
        $scope.panelMeta.loading = false;
        if ($scope.panel.mode !== '-'){
          var _fcm = {
            "sum":"sum",
            "total":"sum",
            "mean":"avg",
            "avg":"avg",
            "min":"min",
            "max":"max",
            "count":"count"
          };
          var value = results.aggregations.stats['0'][_fcm[$scope.panel.mode]];
        }

        //forward_compatible_map
        var _fcm = {
          "sum":"total",
          "avg":"mean"
        };
        var rows = queries.map(function (q) {
          var alias = q.alias || q.query;
          var obj = _.clone(q);
          obj.label = alias;
          obj.Label = alias.toLowerCase(); //sort field
          obj.value = results.aggregations['stats_'+alias]['0'];
          obj.Value = results.aggregations['stats_'+alias]['0']; //sort field
          for(var _k in _fcm){
            if (obj.value[_k] !== undefined){
              obj.value[_fcm[_k]] = obj.value[_k];
              obj.Value[_fcm[_k]] = obj.Value[_k];
            }
          }
          return obj;
        });

        $scope.data = {
          value: value,
          rows: rows
        };

        $scope.$emit('render');
      });
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

  });

  module.filter('formatstats', function(){
    return function (value,format) {
      switch (format) {
      case 'money':
        value = numeral(value).format('$0,0.00');
        break;
      case 'bytes':
        value = numeral(value).format('0.00b');
        break;
      case 'float':
        value = numeral(value).format('0.000');
        break;
      default:
        value = numeral(value).format('0,0');
      }
      return value;
    };
  });

});
