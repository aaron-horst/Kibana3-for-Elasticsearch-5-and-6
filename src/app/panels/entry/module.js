/**  * == terms
 * Status: *Stable*
 *
 * get all dashboards and show them in the panel
 *
 */
define([
  'angular',
  'app',
  //'underscore',
  'lodash',
  'jquery',
  'kbn',
  'config'
],
function (angular, app, _, $, kbn, config) {
  'use strict';

  var module = angular.module('kibana.panels.entry', []);
  app.useModule(module);

  module.filter("filter_mainclass", function(){
    return function(input, query){
      var rst = [];
      for(var i in input){
        if (!query || input[i].title === query){
          rst.push(input[i]);
        }
      }
      return rst;
    }
  });

  module.controller('entry', function($scope, querySrv, dashboard, filterSrv, fields) {
    $scope.panelMeta = {
      modals : [
      ],
      status  : "Stable",
      description : "Displays All dashboard"};

    $scope.init = function () {
      $scope.hits = 0;

      $scope.$on('refresh',function(){
        $scope.get_data();
      });
      $scope.get_data();

    };

    $scope.mainclass_query = "";
    $scope.change_mainclass_query = function(query) {
        $scope.mainclass_query = query;
    }

    $scope.get_color = function(title){
        return "";
    }

    $scope.get_data = function() {
      var request = $scope.ejs.Request();
      request = request.fields(["mainclass","subclass","title"])
        .filter($scope.ejs.TermFilter("_type","dashboard"));
      var result = $scope.ejs.doSearch(config.kibana_index, request,5000);
      result.then(
        // Success
        function(result) {
          var dashboardmainclass = [];
          var dashboardclass = {};
          for (var i in config.dashboard_class){
            for(var k in config.dashboard_class[i])
            dashboardmainclass.push(k);
            dashboardclass[k] = config.dashboard_class[i][k];
          }

          var entries = {}
          for (var i in result['hits']['hits']){
            var fields = result['hits']['hits'][i]['fields'];

            if (fields === undefined){
              continue;
            }

            var mainclass = 'Other';
            if ('mainclass' in fields){
              mainclass = fields['mainclass'][0];
            }
            if (mainclass === ""){
              mainclass = "Other";
            }

            if ('subclass' in fields){
              var subclass = fields['subclass'][0];
            }else{
              if (mainclass in dashboardclass && dashboardclass[mainclass].length > 0){
                var subclass='其它';
              }else{
                var subclass='';
              }
            }

            if (mainclass in entries){
              if (subclass in entries[mainclass]){
                entries[mainclass][subclass].push({title:fields['title'][0],subclass:subclass,mainclass:mainclass});
              } else{
                entries[mainclass][subclass] = [{title:fields['title'][0],subclass:subclass,mainclass:mainclass}];
              }
            }else{
              entries[mainclass] = {};
              entries[mainclass][subclass] = [{title:fields['title'][0],subclass:subclass,mainclass:mainclass}];
            }
          }


          var entriesList = [];

          for(var mainclass in entries){
            var One = {};

            One['title'] = mainclass;

            One['data'] = [];
            for (var subclass in entries[mainclass]){
              entries[mainclass][subclass].sort(function(x,y){
                if (x["title"].toLowerCase()>y["title"].toLowerCase())
                return 1;
                return -1;
              });
              One['data'].push({title:subclass,data:entries[mainclass][subclass]});
            }

            if (mainclass in dashboardclass && dashboardclass[mainclass].length>0){
              One['data'].sort(function(x,y){
                var sortedTitles = dashboardclass[mainclass];

                if (sortedTitles.indexOf(x['title']) == -1){
                  return 1;
                }
                if (sortedTitles.indexOf(y['title']) == -1){
                  return -1;
                }
                return sortedTitles.indexOf(x['title']) - sortedTitles.indexOf(y['title']);
              });
            }
            entriesList.push(One);
          }

          //sort on MainClass
          entriesList.sort(function(x,y){

            if (dashboardmainclass.indexOf(x['title']) == -1){
              return 1;
            }
            if (dashboardmainclass.indexOf(y['title']) == -1){
              return -1;
            }
            return dashboardmainclass.indexOf(x['title']) - dashboardmainclass.indexOf(y['title']);
          });


          $scope.entriesList = entriesList;

          return result;
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
    };

  });

});
