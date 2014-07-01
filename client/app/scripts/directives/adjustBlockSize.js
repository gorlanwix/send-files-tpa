'use strict';

angular.module('sendFiles')
  .directive('adjustBlockSize', function () {
        return {
          link: function(scope, element) {
            var filesBlock;
            var messageTooltip;

            var blocks = element.children();
            console.log('blocks', blocks);
            for (var i = 0; i < blocks.length; i++) {
              if (angular.element(blocks[i]).hasClass('files')) {
                filesBlock = blocks[i];
                break;
              }
            }
            var textareaBlock = element.find('textarea');
            var spanElements = element.find('span');

            for (var j = 0; j < spanElements.length; j++) {
              if (angular.element(spanElements[j]).hasClass('tool-tip-message')) {
                messageTooltip = spanElements[j];
                break;
              }
            }

            angular.element(filesBlock).bind('scroll', function () {
              console.log('running directive!');
              console.log(scope.totalFilesAdded);
              if (scope.totalFilesAdded > 7) {
                angular.element(filesBlock).addClass('files-enlarge');
                angular.element(textareaBlock).addClass('user-message-box-shrink');
                angular.element(messageTooltip).addClass('lower-tool-tip-message');
              }
            });

            textareaBlock.bind('click', function () {
              console.log('running click directive');
              angular.element(filesBlock).removeClass('files-enlarge');
              angular.element(textareaBlock).removeClass('user-message-box-shrink');
              angular.element(messageTooltip).removeClass('lower-tool-tip-message');
            });
          }
        };
      });