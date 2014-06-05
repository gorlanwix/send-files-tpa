'use strict';

module.exports = function (grunt) {
  grunt.file.expand('../node_modules/grunt-*/tasks').forEach(grunt.loadTasks);

  grunt.initConfig({
    mochaTest: {
      test: {
        options: {
          reporter: 'spec'
        },
        src: ['test/**/*.js']
      }
    },

    develop: {
      server: {
        file: 'server.js'
      }
    },
    watch: {
      options: {
        nospawn: true,
        livereload: true
      },
      js: {
        files: ['server.js', 'app.js', 'routes.js'],
        tasks: ['develop']
      }
    }
  });

  grunt.registerTask('default', ['develop', 'watch']);
};
