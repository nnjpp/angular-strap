/**
 * angular-strap
 * @version v2.0.4 - 2014-08-15
 * @link http://mgcrea.github.io/angular-strap
 * @author Olivier Louvignes (olivier@mg-crea.com)
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */
'use strict';
angular.module('mgcrea.ngStrap.typeahead', [
  'mgcrea.ngStrap.tooltip',
  'mgcrea.ngStrap.helpers.parseOptions'
]).provider('$typeahead', function () {
  var defaults = this.defaults = {
      animation: 'am-fade',
      prefixClass: 'typeahead',
      prefixEvent: '$typeahead',
      placement: 'bottom-left',
      template: 'typeahead/typeahead.tpl.html',
      trigger: 'focus',
      container: false,
      keyboard: true,
      html: false,
      delay: 0,
      minLength: 1,
      filter: 'filter',
      limit: 6
    };
  this.$get = [
    '$window',
    '$rootScope',
    '$tooltip',
    '$parse',
    function ($window, $rootScope, $tooltip, $parse) {
      var bodyEl = angular.element($window.document.body);
      function TypeaheadFactory(element, controller, config) {
        var $typeahead = {};
        // Common vars
        var options = angular.extend({}, defaults, config);
        $typeahead = $tooltip(element, options);
        var parentScope = config.scope;
        var scope = $typeahead.$scope;
        scope.$selectedValue = null;
        scope.$resetMatches = function () {
          scope.$matches = [];
          scope.$activeIndex = 0;
        };
        scope.$resetMatches();
        scope.$activate = function (index) {
          scope.$$postDigest(function () {
            $typeahead.activate(index);
          });
        };
        scope.$select = function (index, evt) {
          scope.$$postDigest(function () {
            $typeahead.select(index);
          });
        };
        scope.$isVisible = function () {
          return $typeahead.$isVisible();
        };
        // Public methods
        $typeahead.update = function (matches) {
          scope.$matches = matches;
          if (scope.$activeIndex >= matches.length) {
            scope.$activeIndex = 0;
          }
        };
        $typeahead.activate = function (index) {
          scope.$activeIndex = index;
        };
        $typeahead.select = function (index) {
          scope.$selectedValue = scope.$matches[index].value;
          controller.$setViewValue(scope.$selectedValue);
          controller.$render();
          scope.$resetMatches();
          if (parentScope)
            parentScope.$digest();
          // Emit event
          scope.$emit(options.prefixEvent + '.select', scope.$selectedValue, index);
          if (options.onSelect) {
            var onSelectFn = $parse(options.onSelect);
            if (typeof onSelectFn === 'function')
              onSelectFn(scope);
          }
        };
        // Protected methods
        $typeahead.$isVisible = function () {
          if (!options.minLength || !controller) {
            return !!scope.$matches.length;
          }
          // minLength support
          var isMinLength = angular.isString(controller.$viewValue) && controller.$viewValue.length >= options.minLength;
          return scope.$matches.length && (isMinLength || parseInt(options.minLength) === 0);
        };
        $typeahead.$getIndex = function (value) {
          var l = scope.$matches.length, i = l;
          if (!l)
            return;
          for (i = l; i--;) {
            if (scope.$matches[i].value === value)
              break;
          }
          if (i < 0)
            return;
          return i;
        };
        $typeahead.$onMouseDown = function (evt) {
          // Prevent blur on mousedown
          evt.preventDefault();
          evt.stopPropagation();
        };
        $typeahead.$onKeyDown = function (evt) {
          if (!/(^38$|^40$|^13$|^9$)/.test(evt.keyCode))
            return;
          // Let ngSubmit pass if the typeahead tip is hidden
          if ($typeahead.$isVisible()) {
            evt.preventDefault();
            evt.stopPropagation();
          }
          // Select with enter
          if (evt.keyCode === 13 || evt.keyCode === 9) {
            scope.$matches.length && $typeahead.select(scope.$activeIndex);
          }  // Navigate with keyboard
          else {
            if (evt.keyCode === 38 && scope.$activeIndex > 0)
              scope.$activeIndex--;
            else if (evt.keyCode === 40 && scope.$activeIndex < scope.$matches.length - 1)
              scope.$activeIndex++;
            else if (angular.isUndefined(scope.$activeIndex))
              scope.$activeIndex = 0;
          }
          evt.keyCode !== 9 && evt.preventDefault();
          evt.keyCode !== 9 && evt.stopPropagation();
          scope.$digest();
        };
        // Overrides
        var show = $typeahead.show;
        $typeahead.show = function () {
          show();
          setTimeout(function () {
            $typeahead.$element.on('mousedown', $typeahead.$onMouseDown);
            if (options.keyboard) {
              element.on('keydown', $typeahead.$onKeyDown);
            }
          });
        };
        var hide = $typeahead.hide;
        $typeahead.hide = function () {
          $typeahead.$element.off('mousedown', $typeahead.$onMouseDown);
          if (options.keyboard) {
            element.off('keydown', $typeahead.$onKeyDown);
          }
          hide();
        };
        return $typeahead;
      }
      TypeaheadFactory.defaults = defaults;
      return TypeaheadFactory;
    }
  ];
}).directive('bsTypeahead', [
  '$window',
  '$parse',
  '$q',
  '$typeahead',
  '$parseOptions',
  function ($window, $parse, $q, $typeahead, $parseOptions) {
    var defaults = $typeahead.defaults;
    return {
      restrict: 'EAC',
      require: 'ngModel',
      link: function postLink(scope, element, attr, controller) {
        // Directive options
        var options = { scope: scope };
        angular.forEach([
          'placement',
          'container',
          'delay',
          'trigger',
          'keyboard',
          'html',
          'animation',
          'template',
          'filter',
          'limit',
          'minLength',
          'watchOptions',
          'selectMode',
          'onSelect',
          'inputLabel'
        ], function (key) {
          if (angular.isDefined(attr[key]))
            options[key] = attr[key];
        });
        // Build proper ngOptions
        var filter = options.filter || defaults.filter;
        var limit = options.limit || defaults.limit;
        var ngOptions = attr.ngOptions;
        if (filter)
          ngOptions += ' | ' + filter + ':$viewValue';
        if (limit)
          ngOptions += ' | limitTo:' + limit;
        var parsedOptions = $parseOptions(ngOptions);
        // Initialize typeahead
        var typeahead = $typeahead(element, controller, options);
        // Watch options on demand
        if (options.watchOptions) {
          // Watch ngOptions values before filtering for changes, drop function calls
          var watchedOptions = parsedOptions.$match[7].replace(/\|.+/, '').replace(/\(.*\)/g, '').trim();
          scope.$watch(watchedOptions, function (newValue, oldValue) {
            // console.warn('scope.$watch(%s)', watchedOptions, newValue, oldValue);
            parsedOptions.valuesFn(scope, controller).then(function (values) {
              typeahead.update(values);
              controller.$render();
            });
          }, true);
        }
        // Watch model for changes
        scope.$watch(attr.ngModel, function (newValue, oldValue) {
          // console.warn('$watch', element.attr('ng-model'), newValue);
          scope.$modelValue = newValue;
          // Publish modelValue on scope for custom templates
          parsedOptions.valuesFn(scope, controller).then(function (values) {
            // Prevent input with no future prospect if selectMode is truthy
            // @TODO test selectMode
            if (options.selectMode && !values.length && newValue.length > 0) {
              controller.$setViewValue(controller.$viewValue.substring(0, controller.$viewValue.length - 1));
              return;
            }
            if (values.length > limit)
              values = values.slice(0, limit);
            var isVisible = typeahead.$isVisible();
            isVisible && typeahead.update(values);
            // Do not re-queue an update if a correct value has been selected
            if (newValue === typeahead.$scope.$selectedValue)
              return;
            !isVisible && typeahead.update(values);
            // Queue a new rendering that will leverage collection loading
            controller.$render();
          });
        });
        // Model rendering in view
        controller.$render = function () {
          // console.warn('$render', element.attr('ng-model'), 'controller.$modelValue', typeof controller.$modelValue, controller.$modelValue, 'controller.$viewValue', typeof controller.$viewValue, controller.$viewValue);
          if (controller.$isEmpty(controller.$viewValue))
            return element.val('');
          var index = typeahead.$getIndex(controller.$modelValue);
          var selected = '';
          if (options.inputLabel) {
            var getViewValue = $parse(options.inputLabel);
            selected = getViewValue(scope);
          } else {
            /* Get the label from the ng-options parser if it exists, otherwise use the viewValue (label property if viewValue is object) */
            selected = angular.isNumber(index) ? typeahead.$scope.$matches[index].label : controller.$viewValue;
            if (angular.isObject(selected))
              selected = selected.label;
          }
          if (!angular.isString(selected))
            return;
          controller.$viewValue = selected.replace(/<(?:.|\n)*?>/gm, '').trim();
          element.val(controller.$viewValue);
        };
        // Garbage collection
        scope.$on('$destroy', function () {
          typeahead.destroy();
          options = null;
          typeahead = null;
        });
      }
    };
  }
]);