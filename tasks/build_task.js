module.exports = function(grunt) {

  // Concat and Minify the src directory into dist
  grunt.registerTask('build', [
    'jshint:source',
    'clean:on_start',
    'less:dist',
    'copy:almost_everything_to_temp',
    'replace_rev_in_html',
    'htmlmin:build',
    'cssmin:build',
    'ngAnnotate:build',
    'requirejs:build',
    'clean:temp',
    'build:write_revision'
  ]);

  // run a string replacement on the require config, using the latest revision number as the cache buster
  grunt.registerTask('build:write_revision', function() {
    grunt.event.once('git-describe', function (desc) {
      grunt.config('string-replace.config', {
        files: {
          '<%= destDir %>/app/components/require.config.js': '<%= destDir %>/app/components/require.config.js',
          '<%= destDir %>/app/app.js': '<%= destDir %>/app/app.js'
        },

        options: {
          replacements: [
            {
              pattern: /@REV@/g,
              replacement: grunt.config.data.pkg.version +"-"+ desc.object
            }
          ]
        }
      });
      grunt.task.run('string-replace:config');
    });
    grunt.task.run('git-describe');
  });
};