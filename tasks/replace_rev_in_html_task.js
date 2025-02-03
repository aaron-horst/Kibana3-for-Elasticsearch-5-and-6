module.exports = function(grunt) {
  // Register a task to replace @REV@ in HTML files
  grunt.registerTask('replace_html_revision', function() {
    grunt.config('string-replace.html', {
      files: [{
        expand: true,
        cwd: '<%= srcDir %>',
        src: ['**/*.html'],
        dest: '<%= tempDir %>'
      }],
      options: {
        replacements: [{
          pattern: /@REV@/g,
          replacement: grunt.config.data.pkg.version
        }]
      }
    });
    grunt.task.run('string-replace:html');
  });

  // Register a task to replace @REV@ in HTML files
  grunt.registerTask('replace_rev_in_html', ['replace_html_revision']);
}; 