'use strict';

angular.module('sendFiles')
  .directive('adjustBlockSize', function () {
        return {
          link: function(scope, element) {
            var filesBlock;

            var blocks = element.children();
            for (var i = 0; i < blocks.length; i++) {
              if (angular.element(blocks[i]).hasClass('files')) {
                filesBlock = blocks[i];
                break;
              }
            }
            var textareaBlock = element.find('textarea');

            var growMessageShrinkFiles = function() {
              angular.element(filesBlock).removeClass('files-enlarge');
              angular.element(textareaBlock).removeClass('user-message-box-shrink');
            };

            angular.element(filesBlock).bind('scroll', function () {
              if (scope.totalFilesAdded > 7 && (!scope.focusedTextarea || scope.onFiles)) {
                angular.element(filesBlock).addClass('files-enlarge');
                angular.element(textareaBlock).addClass('user-message-box-shrink');
              }
            });

            textareaBlock.bind('focus', function () {
              growMessageShrinkFiles();
            });

            textareaBlock.bind('keypress', function () {
              growMessageShrinkFiles();
            });
          }
        };
      });