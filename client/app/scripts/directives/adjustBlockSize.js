'use strict';
/**
 * This directive binds event listeners to the file block and the message
 * box that listen for when the user interacts with those blocks. When the user
 * scrolls in the files block - and they've uploaded at least 7 files - the
 * file block will grow and the message box will shrink. The opposite occurs
 * when the user begins typing in the message box.
 */
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
              angular.element(textareaBlock).removeClass('message-box-shrink');
            };

            angular.element(filesBlock).bind('scroll', function () {
              if (scope.totalFilesAdded >= 7 && (!scope.focusedTextarea || scope.onFiles)) {
                angular.element(filesBlock).addClass('files-enlarge');
                angular.element(textareaBlock).addClass('message-box-shrink');
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