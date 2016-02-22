/** @scratch /panels/5
 *
 * include::panels/terms.asciidoc[]
 */

/** @scratch /panels/terms/0
 *
 * == terms
 * Status: *Stable*
 *
 * Displays the results of an elasticsearch terms aggs to used as filters.
 * click is must, right click is must_not
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

  var module = angular.module('kibana.panels.multiplechoice', []);
  app.useModule(module);

  module.controller('multiplechoice', function($scope, querySrv, dashboard, filterSrv, fields) {
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
      description : "Displays the results of an elasticsearch terms aggs " +
        "to used as filters. click is must, right click is must_not."
    };

    // Set and populate defaults
    var _d = {
      /** @scratch /panels/terms/5
       * === Parameters
       *
       * field:: The field on which to computer the facet
       */
      field   : '_type',
      /** @scratch /panels/terms/5
       * exclude:: terms to exclude from the results
       */
      exclude : [],
      /** @scratch /panels/terms/5
       * missing:: Set to false to disable the display of a counter showing how much results are
       * missing the field
       */
      missing : false,
      /** @scratch /panels/terms/5
       * other:: Set to false to disable the display of a counter representing the aggregate of all
       * values outside of the scope of your +size+ property
       */
      other   : false,
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
       * tmode:: Facet mode: terms or terms_stats
       */
      tmode       : 'terms',
      /** @scratch /panels/terms/5
       * tstat:: Terms_stats facet stats field
       */
      tstat       : 'total',
      /** @scratch /panels/terms/5
       * valuefield:: Terms_stats facet value field
       */
      valuefield  : ''
    };

    _.defaults($scope.panel,_d);

    var filter_id;
    var filter_mandata;
    var refresh_filter_id = function(){
      filter_id = $scope.filter_id = {};
      filter_mandata = $scope.filter_mandata = {};
      var filters = $scope.dashboard.current.services.filter.list, filter;
      var query;
      for(var i in filters){
        filter = filters[i];
        if(filter.type != 'terms'  && filter.type != 'exists') {
          if(filter.type == 'querystring' && filter.mandate == 'must') {
            query = parseQuerySting(filter.query);
            if(query && $scope.field == query.field) {
              filter_id['querystring'] = Number(i);
              for(var label in query.value){
                  filter_mandata[label] = {active: true, isNot: query.value[label] == 'NOT'}
              }
            }
          }
          continue;
        }
        if(filter.field == $scope.field){
          if(filter.type == 'exists'){
            filter_id['Missing field'] = Number(i);
          } else {
            //filter_id[filter.value] = Number(i);
          }
        }
      }
      $scope.needApply = false;
    };
    var parseQuerySting = function(str) {
      var pattern1 = /^\s*([^\s]+)\s*\:\s*\(((?:\s*(?:\s+(?:NOT|OR|AND)\s+)?(\"?)[^\(\)\s\:\"]+\3\s*)+)\)\s*$/;
      var pattern2 = /\s*(?:(NOT|OR|AND)\s+)?(\"?)([^\(\)\s\:\"]+)\2/g;
      var pattern3 = /^\s*([^\s]+)\s*\:\s*((?:\s*(?:\s+(?:NOT|OR|AND)\s+)?(\"?)[^\(\)\s\:\"]+\3\s*)+)\s*$/;
      var mts, vs;
      mts = str.match(pattern1);
      if (mts == null) {
        mts = str.match(pattern3);
        if (mts == null) {
          return null;
        }
      }
      vs = mts[2];
      var res = {
        field: mts[1],
        value: {}
      };
      while (mts = pattern2.exec(vs)) {
        if (mts != null) {
          res.value[mts[3]] = mts[1] || 'OR';
        }
      }
      return res;
    };
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

      // This could probably be changed to a BoolFilter
      boolQuery = $scope.ejs.BoolQuery();
      _.each(queries,function(q) {
        boolQuery = boolQuery.should(querySrv.toEjsObj(q));
      });

      request = request.query(
        $scope.ejs.FilteredQuery(
          boolQuery,
          filterSrv.getBoolFilterWithoutField(filterSrv.ids(), $scope.field)
        )
      );

      var terms_aggs = $scope.ejs.TermsAggregation('terms')
      .field($scope.field)
      .size($scope.panel.size)
      .exclude($scope.panel.exclude);

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
      }
      // Terms mode
      request = request.agg(terms_aggs);

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

    $scope.$on('render',function(){
      getChoiceData();
      refresh_filter_id();
    });

    function getChoiceData(){
      var k = 0;
      var data = [];
      _.each($scope.results.aggregations.terms.buckets, function (v) {
        var slice;
        slice = { label: v.key, data: [
          [k, v.doc_count]
        ], actions: true};
        data.push(slice);
        k = k + 1;
      });

      // TODO
      // data.push({label: 'Missing field',
      //   data: [[k, $scope.results.facets.terms.missing]],
      //   meta: "missing", color: '#aaa', opacity: 0});
      //
      // if ($scope.panel.tmode === 'terms') {
      //   data.push({label: 'Other values',
      //     data: [[k + 1, $scope.results.facets.terms.other]],
      //     meta: "other", color: '#444'});
      // }

      // Make a clone we can operate on.
      var ChoiceData = _.clone(data);
      ChoiceData = $scope.panel.missing ? ChoiceData :
        _.without(ChoiceData,_.findWhere(ChoiceData,{meta:'missing'}));
      ChoiceData = $scope.panel.other ? ChoiceData :
        _.without(ChoiceData,_.findWhere(ChoiceData,{meta:'other'}));

      $scope.choiceData = ChoiceData;
    }


    $scope.build_search = function(term, negate) {
      if(filter_mandata[term.label]) {
        if(filter_mandata[term.label].active){
          filter_mandata[term.label].active = false;
        } else {
          filter_mandata[term.label].active = true;
          filter_mandata[term.label].isNot = !negate
        }
      } else {
        filter_mandata[term.label] = {active: true, isNot: !negate}
      }
      $scope.needApply = true;
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

    $scope.contextmenuCallback = function(event, term){
      if(typeof event.preventDefault === "function"){
        event.preventDefault();
        event.stopPropagation();
      }else{
        event.returnValue = false;
        event.cancelBubble = true;
      }
      $scope.build_search(term, false);
    };

    $scope.clearAllFilter = function(){
      if(filter_id['querystring']){
        filterSrv.remove(filter_id['querystring']);
      }
    };

    $scope.applyFilter = function(){
      var mandata, querystr = '';
      for(var label in filter_mandata){
        mandata = filter_mandata[label];
        if(mandata.active){
          querystr += (mandata.isNot ? ' NOT ': ' ') + ('"' + label + '"');
        }
      }
      if(filter_id['querystring']){
        if(querystr == ''){
          filterSrv.remove(filter_id['querystring']);
        }else{
          filterSrv.set({type:'querystring',query:$scope.field +': ('+ querystr +')', mandate: 'must'}, filter_id['querystring']);
        }

      } else {
        if(querystr != '') {
          filter_id['querystring'] = filterSrv.set({type: 'querystring', query: $scope.field + ': (' + querystr + ')', mandate: 'must'});
        }
      }
    }
  });
});
