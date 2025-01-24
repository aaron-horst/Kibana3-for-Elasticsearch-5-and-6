# Kibana 3 for Elasticsearch Version 5.x

## Notes

This project preserves original Kibana 3 funtionality to work in Elasticsearch version 5.x, 6.x, and 7.x. Presently it's built and tested against Elasticsearch version 7.x. Note that this project contains some experimental panel visualizations not part of the original Kibana 3 project. It was derived and pared down from [the following repo](https://libraries.io/github/childe/kibana-authorization) (updated link from repo no longer on github).

## Running the project locally

* Install node & npm 
 * node: https://nodejs.org/en/
* npm install -g grunt-cli 
* npm install in kibana folder 
* to run the project: grunt server
* to build the project: grunt build

## Build Issues
* If errors occur installing scratchy run: git config --global url.https://github.com/.insteadOf git://github.com/