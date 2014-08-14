chenryn's changelog
================

## percentile panel

Percentile is a great data analysis method. Elasticsearch add percentile aggregation support after version 1.1.0. But Kibana v3 use an outdate elastic.js which don't support aggergation! So I write this panel using native angularjs `$.http` api.

*Elasticsearch had add percentile rank in version 1.3.0, so exciting!*

*Tips: merged new version of elasticjs at 2014/08/15, should rewrite this panel now.*

## china map

Use map.cn.js from <http://jvectormap.com/maps/countries/china/>, delete `CN-` because `filter/geoip` don't have such prefix.

Add Taiwan to this map.

Many thanks to this author(@loveshell)!

## term_stats map

Provide a way to choose the stat to display into the map, not only the total number of hits but also min/max/total etc.

Many thanks to this author(@eMerzh)!

<https://github.com/elasticsearch/kibana/pull/1270>

## statisticstrend panel

This panel is so useful if you want to check the trend of your statistic history.

![](https://raw.githubusercontent.com/opsSysDev/kibana-panels/master/images/statisticstrend/display.png)

Many thanks to this author(@opsSysDev)!

## multifieldhistogram panel

Enable histogram panel to plot multiple fields.

![](https://cloud.githubusercontent.com/assets/5235401/3243726/d3fb976e-f15d-11e3-9f70-119007994c31.png)

Many thanks to this author(@tvvmb)!

<https://github.com/elasticsearch/kibana/pull/1296>

## valuehistogram panel

Enhances the histogram panel to support value-based histograms in addition to time-series histograms.

![](https://camo.githubusercontent.com/53801c754a034c3646874c1029f244edd681863b/68747470733a2f2f662e636c6f75642e6769746875622e636f6d2f6173736574732f333137383838382f313432323636332f38316463613039322d336666652d313165332d383932622d6535656163643834636336662e706e67)

Many thanks to this author(@jdve)!

<https://github.com/elasticsearch/kibana/pull/622>

## panel refresh

Adds refresh icon to kibana panel directive which broadcasts a refresh event down its scope chain.

Many thanks to this author(@thegreenpizza)!

<https://github.com/elasticsearch/kibana/pull/1423>

## Upgraded angular, elasticsearchjs and elasticjs

* Angular is now at 1.2.20
* Elasticsearch JS now included
* Updated to the latest elasticjs

<https://github.com/elasticsearch/kibana/pull/1377>
