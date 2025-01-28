module.exports = function(config) {
  return {
    build: {
      files: [
        {
          expand: true, // Enable dynamic expansion
          src: [
            'app/controllers/**/*.js',
            'app/directives/**/*.js',
            'app/services/**/*.js',
            'app/filters/**/*.js',
            'app/panels/**/*.js',
            'app/app.js',
            'vendor/angular/**/*.js',
            'vendor/elasticjs/elastic-angular-client.js'
          ],
          dest: '<%= tempDir %>',
          ext: '.annotated.js', // Add suffix to processed files
          extDot: 'last' // Use the last dot in filename for the extension
        }
      ]
    }
  };
};