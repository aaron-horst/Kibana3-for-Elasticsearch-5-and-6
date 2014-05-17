/*

  ## Percentiles Module

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
  'numeral',
  'config'
], function (
  angular,
  app,
  _,
  $,
  kbn,
  numeral,
  config
) {

  'use strict';

  var module = angular.module('kibana.panels.percentiles', []);
  app.useModule(module);

  module.controller('percentiles', function ($scope, querySrv, dashboard, filterSrv, $http) {

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
      description: 'A percentiles panel for displaying aggregations using the Elastic Search percentiles aggregation query.'
    };

    $scope.modes = ['50.0','75.0','90.0','95.0','99.0'];

    var defaults = {
      queries     : {
        mode        : 'all',
        ids         : []
      },
      style   : { "font-size": '24pt'},
      format: 'number',
      mode: 'count',
      display_breakdown: 'yes',
      sort_field: '',
      sort_reverse: false,
      label_name: 'Query',
      value_name: 'Value',
      spyable     : true,
      show: {
        '50.0': true,
        '75.0': true,
        '90.0': true,
        '95.0': true,
        '99.0': true,
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
      console.log(field);
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

      // This could probably be changed to a BoolFilter
      boolQuery = $scope.ejs.BoolQuery();
      _.each(queries,function(q) {
        boolQuery = boolQuery.should(querySrv.toEjsObj(q));
      });

      request = {
        'stats': {
          'filter': JSON.parse($scope.ejs.QueryFilter(
            $scope.ejs.FilteredQuery(
              boolQuery,
              filterSrv.getBoolFilter(filterSrv.ids())
            )
          ).toString(), true),
          'aggs': {
            'stats': {
              'percentiles': {
                'field': $scope.panel.field,
                'percents': $scope.modes
              }
            }
          }
        }
      };

      $.each(queries, function (i, q) {
        var query = $scope.ejs.BoolQuery();
        query.should(querySrv.toEjsObj(q));
        var qname = 'stats_'+i;
        var aggsquery = {};
        aggsquery[qname] = {
          'percentiles': {
            'field': $scope.panel.field,
            'percents': $scope.modes
          }
        };
        request[qname] = {
          'filter': JSON.parse($scope.ejs.QueryFilter(
            $scope.ejs.FilteredQuery(
              query,
              filterSrv.getBoolFilter(filterSrv.ids())
            )
          ).toString(), true),
          'aggs': aggsquery
        };
      });
      // Populate the inspector panel
      $scope.inspector = angular.toJson({aggs:request},true);

      results = $http({
        url: config.elasticsearch + '/' + dashboard.indices + '/_search?size=0',
        method: "POST",
        data: { aggs: request }
      });

      results.then(function(results) {
        $scope.panelMeta.loading = false;
        var value = results.data.aggregations.stats['doc_count'];

        var rows = queries.map(function (q, i) {
          var alias = q.alias || q.query;
          var obj = _.clone(q);
          obj.label = alias;
          obj.Label = alias.toLowerCase(); //sort field
          obj.value = results.data.aggregations['stats_'+i]['stats_'+i];
          obj.Value = results.data.aggregations['stats_'+i]['stats_'+i]; //sort field
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
