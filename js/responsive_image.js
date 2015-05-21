'use strict';

/**
 * Base Class handling responsive images via Drupal image styles
 */

(function ($, window, document, undefined) {

  var RI_CLASSNAMES;
  var ResponsiveImage;

  RI_CLASSNAMES = {
    PROXY_SIZE_CONTAINER_SELECTOR: false,
    WRAPPER: 'focal-point-wrapper',
    IMAGE: 'responsive-image',
    STATE: {
      IS_LOADING: 'responsive-image--loading-state',
      IS_LOADED: 'responsive-image--loaded-state',
      IS_IN_VIEWPORT: 'responsive-image--in-viewport-state',
      IS_INITIAL_LOADING: 'responsive-image--initial-loading-state',
      ELEMENT_IS_HANDLED: 'responsive-image--handled-state'
    },
  };

  /**
   * responsive image class. Will load a new src on size changes
   */

  ResponsiveImage = function(element, options) {
    this.element = element;
    this.classNames = options.classNames;
    this.element.addClass(this.classNames.IMAGE);
    this.options = options;
    this.devicePixelRatio = this.getDevicePixelRatio();
    this.mayApplyFocalPoint = this.element.parent().hasClass(this.classNames.WRAPPER);
    this.firstImage = true;
    this.imageWidth = this.imageHeight = 1;
    this.parentElement = this.getParentContainer();
    if (this.options) {
      this.init();
    }
  };

  ResponsiveImage.prototype.getParentContainer = function() {
    var parentElement = this.element.parent();
    var selectors  = [];

    // REVIEW: Could use this.element.data('parentContainer') ?
    var selector = this.element.attr('data-parent-container');
    var containerElement;

    if (this.classNames.PROXY_SIZE_CONTAINER_SELECTOR) {
      selectors.push(this.classNames.PROXY_SIZE_CONTAINER_SELECTOR);
    }

    if(selector) {
      selectors.push(this.classNames.PROXY_SIZE_CONTAINER_SELECTOR);
    }

    containerElement = this.element.closest(selectors.join());
    if(containerElement[0]) {
      parentElement = containerElement;
    }

    return parentElement;
  };

  ResponsiveImage.prototype.debounce = function(callback, wait) {
    var result;
    var timeout;
    var context = this;
    var args = arguments;
    var later = function() {
      timeout = null;
      result = callback.apply(context, args);
    };

    window.clearTimeout(timeout);
    timeout = window.setTimeout(later, wait);
  };

  /*
   * REVIEW: Could be static, as properties are not linked to this instance,
   *  but rather to window.devicePixelRatio ?
   */

  ResponsiveImage.prototype.getDevicePixelRatio = function() {
    var ratio = 1;

    if (typeof window.devicePixelRatio !== 'undefined') {
      ratio = window.devicePixelRatio >= 1.5 ? 2 : 1;
    }

    return ratio;
  };

  ResponsiveImage.prototype.init = function() {

    // add elem to viewportManager
    var parentElement = this.parentElement;

    window.Drupal.viewportSingleton.add(
      parentElement,
      function() {
        this.compute();
      }.bind(this),
      function(inViewport) {
        this.handleInViewport(inViewport);
      }.bind(this));

    // bind to resize
    $(window).on('resize', $.proxy(this.handleResize, this));

    this.compute();
    this.applyFocalPoint();
  };

  ResponsiveImage.prototype.handleInViewport = function(elementInViewport) {
    this.setState({
      isInViewport: elementInViewport
    });
  };

  ResponsiveImage.prototype.handleResize = function() {
    this.applyFocalPoint();
    this.debounce(this.compute, 250); // REVIEW: Magic number.
  };

  // find best match
  ResponsiveImage.prototype.findBestMatchingRatio = function(width, height) {
    var min_d = 1000.0; // REVIEW: What is min_d ?
    var desiredRatioName;
    var sourceRatio = (height !== 0) ? width / height : 1.0;
    var delta;
    var ratio;
    var size;

    $.each(this.options.ratios, function(index, element) {

      if(!desiredRatioName) {
        desiredRatioName = index;
      }

      if (element.crop) {
        size = element.crop;
        ratio = size.width / size.height;
        delta = Math.abs(sourceRatio - ratio);

        if (delta < min_d) {
          desiredRatioName = index;
          min_d = delta;
        }
      }
    });

    return desiredRatioName;
  };

  /*
   * REVIEW: Complexity? Could be split into multiple methods?
   */

  ResponsiveImage.prototype.compute = function() {
    var parentElement = this.parentElement;
    var crop;
    var cs; // REVEW: What is cs, computedSize?, currentSize, containerSize?
    var current;
    var desiredRatio;
    var max;
    var min;
    var newSrc;
    var range;
    var rangeKey;
    var scale;
    var sizeKey;

    if (!window.Drupal.viewportSingleton.inExtendedViewport(parentElement)) {
      return;
    }

    cs = {
      width: parentElement.width(),
      height: parentElement.height()
    };

    if (cs.width === 0) { // REVIEW: Could test to !cs.width ?
      return;
    }

    desiredRatio = this.findBestMatchingRatio(cs.width, cs.height);

    // we need to adjust the width and the height, as the image might be scaled
    if (this.mayApplyFocalPoint) {
      crop = this.options.ratios[desiredRatio].crop;
      scale = Math.max(cs.width / crop.width, cs.height / crop.height);
      cs.width = Math.round(scale * crop.width);
      cs.height = Math.round(scale * crop.height);
    }

    // REVIEW: I'm assuming that 'ls' means 'landscape', is that clear enough?
    sizeKey = (desiredRatio === 'ls') ? 'width' : 'height';
    rangeKey = (desiredRatio === 'ls') ? 'Width' : 'Height';
    range = this.options.ratios[desiredRatio];

    min = range['min' + rangeKey];
    max = range['max' + rangeKey];
    current = cs[sizeKey];

    current = Math.round((current-min) / this.options.steps) * this.options.steps + min;
    current = Math.min(Math.max(current, min), max);

    newSrc = this.getPresetUrl(desiredRatio, current * this.devicePixelRatio);
    this.requestNewImage(newSrc);
  };

  ResponsiveImage.prototype.setState = function(obj) {
    var _this = this;
    var states = {
      isLoading: {
        on: (this.firstImage) ? this.classNames.STATE.IS_INITIAL_LOADING : this.classNames.STATE.IS_LOADING,
        off: this.classNames.STATE.IS_LOADED
      },
      isLoaded: {
        on: this.classNames.STATE.IS_LOADED,
        off: [this.classNames.STATE.IS_INITIAL_LOADING, this.classNames.STATE.ISLOADING].join(' ')
      },
      isInViewport: {
        on: this.classNames.STATE.IS_IN_VIEWPORT,
        off: false
      }
    };

    $.each(obj, function(key, value) {
      var state;
      var on;
      var off;

      if (key in states) {
        state = states[key];
        on = value ? state.on : state.off;
        off = value ? state.off : state.on;

        if (on) {
          _this.elem.addClass(on);
        }

        if (off) {
          _this.elem.removeClass(off);
        }
      }
    });
  };

  ResponsiveImage.prototype.requestNewImage = function(newSrc) {
    var currentSrc = this.element.attr('src');
    var tempImage;

    if (newSrc != currentSrc) {
      this.setState({
        isLoading: true
      });

      if (this.tempImage) {
        this.tempImage.removeAttr('src');
        this.tempImage = null;
      }

      // REVIEW: Could use non-anonymous function?
      tempImage = $('<img>')
        .load($.proxy(
          function() {
            this.element.attr('src', tempImage.attr('src'));
            this.imageWidth = tempImage[0].width;
            this.imageHeight = tempImage[0].height;

            $.event.trigger({
              type: 'responsiveImageReady',
              image: this.element,
              first: this.firstImage
            });

            this.firstImage = false;
            this.setState({isLoaded: true});
            this.applyFocalPoint();
          },
          this)
        )
        .attr('src', newSrc);

      this.tempImage = tempImage;
    }
  };

  ResponsiveImage.prototype.getPresetUrl = function(ratio, size) {
    var path = window.Drupal.settings.basePath +
      window.Drupal.settings.responsive_image_styles.file_path +
      '/styles/' + this.options.style +
      '_' + ratio +
      '_' + this.options.type +
      '_' + size +
      '/public/';
    return this.options.src.replace('public://', path);
  };

  /*
   * REVIEW: Complexity? Could be split into multiple methods?
   * REVIEW: this.options are snake_cased?
   */

  ResponsiveImage.prototype.applyFocalPoint = function() {
    var parentWidth = this.parentElement.width();
    var parentHeight = this.parentElement.height();
    var newWidth;
    var newHeight;
    var aspectRatio;

    // Return early if parent container is undefined.
    if ((parentWidth === undefined) || (parentHeight === undefined)) {
      return;
    }

    if (!this.mayApplyFocalPoint || (this.imageWidth === undefined)) {

      if (this.options.full_width) {

        if(this.firstImage) {
          aspectRatio = this.options.full_height / this.options.full_width;
          newWidth = parentWidth;
          newHeight = parentWidth * aspectRatio;

          // REVIEW: Obsolete?
          // if (newHeight > parentHeight) {
          //   newHeight = parentHeight;
          //   newWidth = parentHeight * this.options.aspectRatio;
          // }

          this.element.css({
            width: Math.round(newWidth),
            height: Math.round(newHeight)
          });
        }
        else {
          this.element.css({
            width: '',
            height: ''
          });
        }
      }

      return;
    }

    var img_w = this.imageWidth;
    var img_h = this.imageHeight;

    // console.log("apply focal point", this.options.src, img_w, img_h, parentWidth, parentHeight);

    var scale = Math.max(parentWidth / img_w, parentHeight / img_h);
    newWidth = Math.ceil(scale * img_w);
    newHeight = Math.ceil(scale * img_h);

    var dx = Math.round((parentWidth - newWidth) * this.options.focalPoint.x / 100.0);
    var dy = Math.round((parentHeight - newHeight) * this.options.focalPoint.y / 100.0);

    // console.log('d', dx, dy,'new', newWidth,newHeight, 'scale', scale, 'img', img_w, img_h, 'parent', parentWidth, parentHeight, 'fp', this.options.focalPoint);

    this.element.css({left: dx, top: dy, width: newWidth, height: newHeight});

    // console.log(this.element.css('left'), this.element.css('top'));
  };

  /*
   * Expose variables to the global window object.
   */

  window.ResponsiveImage = ResponsiveImage;
  window.RI_CLASSNAMES = RI_CLASSNAMES;

})(jQuery, window, document);
