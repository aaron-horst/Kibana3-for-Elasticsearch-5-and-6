define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('monitor', function() {

    var self = this;

    this.check = function(data, title, threshold) {
      var ret, latestId;
      latestId = _.max(_.keys(data));
      if (threshold) {
        ret = data[latestId] - threshold > 0 ? true : false;
      } else {
        ret = detect(data);
      };
      if (ret) {
        self.notify(title, data[latestId]);
      };
    };

    var detect = function(data) {
      var latestId = _.max(_.keys(data));
      var array = _.values(data);
      var latest = data[latestId];
      // TODO: anomaly detection
 
      return true;
    };

    this.notify = function(title, msg) {
      if(!("Notification" in window)){
        console.log("not support notification");
      }
      else if (Notification.permission === 'granted') {
        var notification = new Notification(title, {
          body: msg,
          dir : 'rtl',
          lang: 'zh-guoyu',
        });
        notification.onshow = function() {
          setTimeout(notification.close, 1000);
        };
      }
      else if (Notification.permission !== 'denied') {
        Notification.requestPermission(function(permission){
          if (!('permission' in Notification)) {
            Notification.permission = permission;
          }
          if (permission === 'granted') {
            var notification = new Notification("Notify begin", {
              body: 'kibana histogram panel notification'
            });
          }
        });
      };
    };

  });

});
