/** @scratch /panels/5
 *
 * include::panels/map.asciidoc[]
 */

/** @scratch /panels/map/0
 *
 * == Map
 * Status: *Stable*
 *
 * The map panel translates 2 letter country or state codes into shaded regions on a map. Currently
 * available maps are world, usa and europe.
 *
 */
define([
  'angular',
  'app',
  'lodash',
  'jquery',
  'config',
  './lib/jquery.jvectormap.min'
],
function (angular, app, _, $) {
  'use strict';

  var module = angular.module('kibana.panels.map', []);
  app.useModule(module);

  module.controller('map', function($scope, $rootScope, querySrv, dashboard, filterSrv) {
    $scope.panelMeta = {
      editorTabs : [
        {title:'Queries', src:'app/partials/querySelect.html'}
      ],
      modals : [
        {
          description: "Inspect",
          icon: "icon-info-sign",
          partial: "app/partials/inspector.html",
          show: $scope.panel.spyable
        }
      ],
      status  : "Stable",
      description : "Displays a map of shaded regions using a field containing a 2 letter country "+
       ", or US state, code. Regions with more hit are shaded darker. Node that this does use the"+
       " Elasticsearch terms aggregation, so it is important that you set it to the correct field."
    };

    // Predefined mapping of state names to 2-letter codes
    const stateNameToCodeMap = {
      "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
      "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
      "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
      "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
      "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
      "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
      "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
      "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
      "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
      "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI",
      "South Carolina": "SC", "South Dakota": "SD", "Tennessee": "TN",
      "Texas": "TX", "Utah": "UT", "Vermont": "VT", "Virginia": "VA",
      "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY"
    };

    // Set and populate defaults
    var _d = {
      /** @scratch /panels/map/3
       *
       * === Parameters
       *
       * map:: Map to display. world, usa, europe
       */
      map     : "world",
      /** @scratch /panels/map/3
       * colors:: An array of colors to use to shade the map. If 2 colors are specified, shades
       * between them will be used. For example [`#A0E2E2', `#265656']
       */
      colors  : ['#A0E2E2', '#265656'],
      /** @scratch /panels/map/3
       * size:: Max number of regions to shade
       */
      size    : 100,
      /** @scratch /panels/map/3
       * exclude:: exclude this array of regions. For example [`US',`BR',`IN']
       */
      exclude : [],
      /** @scratch /panels/map/3
       * spyable:: Setting spyable to false disables the inspect icon.
       */
      spyable : true,
      /** @scratch /panels/map/5
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
      /** @scratch /panels/map/3
       * tmode:: Aggregation mode: terms or terms_stats
       */
      tmode       : 'terms',
      /** @scratch /panels/map/3
       * tstat:: Terms_stats aggregation stats field
       */
      tstat       : 'total',
      /** @scratch /panels/map/3
       * valuefield:: Terms_stats aggregation value field
       */
      valuefield  : ''
    };
    _.defaults($scope.panel,_d);

    $scope.init = function() {
      $scope.$on('refresh',function() {
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
        queries;

      $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);
      request = $scope.ejs.Request();
      queries = querySrv.getQueryObjs($scope.panel.queries.ids);

      var boolQuery = filterSrv.getBoolQuery(filterSrv.ids());
      _.each(queries,function(q) {
        boolQuery = boolQuery.should(querySrv.toEjsObj(q));
      });

      request.query(boolQuery);

      // Then the insert into aggregation and make the request
      // Terms mode
      if($scope.panel.tmode === 'terms') {
        request = request
        .agg(
          $scope.ejs.TermsAggregation('map')
          .field($scope.panel.field)
          .size($scope.panel.size)
          .exclude($scope.panel.exclude)
        );
      }
      if($scope.panel.tmode === 'terms_stats') {
        var sub_aggs;
        switch($scope.panel.tstat) {
        case 'min':
          sub_aggs = $scope.ejs.MinAggregation('subaggs')
          .field($scope.panel.valuefield);
          break;
        case 'max':
          sub_aggs = $scope.ejs.MaxAggregation('subaggs')
          .field($scope.panel.valuefield);
          break;
        case 'total':
          sub_aggs = $scope.ejs.SumAggregation('subaggs')
          .field($scope.panel.valuefield);
          break;
        case 'mean':
          sub_aggs = $scope.ejs.AvgAggregation('subaggs')
          .field($scope.panel.valuefield);
          break;
        }
        request = request.agg(
          $scope.ejs.TermsAggregation('map')
          .field($scope.panel.field)
          .size($scope.panel.size)
          .agg(sub_aggs)
        );
      }


      $scope.populate_modal(request);

      var results = $scope.ejs.doSearch(dashboard.indices, request);

      // Populate scope when we have results
      results.then(function(results) {
        $scope.panelMeta.loading = false;
        $scope.hits = results.hits.total;
        $scope.data = {};
        _.each(results.aggregations.map.buckets, function(v) {
          let key = v.key;
          if (stateNameToCodeMap[key]) {
            key = stateNameToCodeMap[key]; // Transform full state name to 2-letter code
          }

          if($scope.panel.tmode === 'terms') {
            //slice = { label : v.term, data : [[k,v.count]], actions: true};
            $scope.data[key] = v.doc_count;
          }
          if($scope.panel.tmode === 'terms_stats') {
            $scope.data[key] = v.subaggs.value;

            //slice = { label : v.term, data : [[k,v[scope.panel.tstat]]], actions: true};
          }
          //$scope.data[v.term.toUpperCase()] = v.total;
        });
        $scope.$emit('render');
      });
    };

    // I really don't like this function, too much dom manip. Break out into directive?
    $scope.populate_modal = function(request) {
      $scope.inspector = request.toJSON();
    };

    $scope.build_search = function (field, value) {
      // Reverse the stateNameToCodeMap to map 2-letter codes to full names
      const codeToStateNameMap = Object.fromEntries(
        Object.entries(stateNameToCodeMap).map(([fullName, code]) => [code, fullName])
      );

      // Transform the value if it is a 2-character state code
      if (value.length === 2 && codeToStateNameMap[value]) {
        value = codeToStateNameMap[value]; // Convert to full state name
      }

      filterSrv.set({ type: 'field', field: field, query: value, mandate: "must" });
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


  module.directive('map', function() {
    return {
      restrict: 'A',
      link: function(scope, elem) {

        elem.html('<center><img src="img/load_big.gif"></center>');

        // Receive render events
        scope.$on('render',function(){
          slow();
        });

        elem.closest('.panel').resize(function () {
          elem.empty();
        });

        function render_panel() {
          elem.empty();
          elem.css({height:scope.panel.height||scope.row.height});
          $('.jvectormap-zoomin,.jvectormap-zoomout,.jvectormap-label').remove();
          require(['./panels/map/lib/map.'+scope.panel.map], function () {
            elem.vectorMap({
              map: scope.panel.map,
              regionStyle: {initial: {fill: '#8c8c8c'}},
              zoomOnScroll: false,
              backgroundColor: null,
              series: {
                regions: [{
                  values: scope.data,
                  scale: scope.panel.colors,
                  normalizeFunction: 'polynomial'
                }]
              },
              onRegionLabelShow: function(event, label, code){
                elem.children('.map-legend').show();
                var count = _.isUndefined(scope.data[code]) ? 0 : scope.data[code];
                elem.children('.map-legend').text(label.text() + ": " + count);
              },
              onRegionOut: function() {
                elem.children('.map-legend').hide();
              },
              onRegionClick: function(event, code) {
                var count = _.isUndefined(scope.data[code]) ? 0 : scope.data[code];
                if (count !== 0) {
                  scope.build_search(scope.panel.field,code);
                }
              }
            });
            elem.prepend('<span class="map-legend"></span>');

            elem.children('.map-legend').hide();
          });
        }

        var slow = _.debounce(render_panel, 200);
      }
    };
  });
});
