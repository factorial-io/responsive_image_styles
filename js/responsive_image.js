/**
 * Base Class handling responsive images via drupal image styles
 */

(function ($) {

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


  Interpolators = {
    linear: function(input) { return input; },
    quadric: function(input) { return input * input; },
    cubic: function(input) { return input * input *input; },
    get: function(name) { return this[name] ? this[name] : this['linear']; }
  };


  /**
   * responsive image class. Will load a new src on size changes
   */
  ResponsiveImage = function(elem, options) {
    this.viewport = options.viewport;
    this.elem = elem;
    this.classNames = options.classNames;
    this.elem.addClass(this.classNames.IMAGE);
    this.options = options;
    this.currentSrc = false;

    // Get Interpolator functions.
    $.each(['ls', 'sq', 'po'], function(index, key) {
      if (this.options.ratios[key]) {
        var interpolation = this.options.ratios[key].interpolation || 'linear';
        this.options.ratios[key].interpolation = Interpolators.get(interpolation);
      }
    }.bind(this));

    this.devicePixelRatio = this.viewport.getDevicePixelRatio();
    this.mayApplyFocalPoint = this.elem.parent().hasClass(this.classNames.WRAPPER);
    this.firstImage = true;
    this.imageWidth = this.imageHeight = 1;
    this.parentElem = this.getParentContainer();
    if (!this.options['updateCallbacks']) {
      this.options['updateCallbacks'] =  [];
    }

    if (this.options) {
      this.init();
    }
  };

  ResponsiveImage.prototype.getParentContainer = function() {
    var parent_elem = this.elem.parent();
    var selectors  = [];
    if (this.classNames.PROXY_SIZE_CONTAINER_SELECTOR) {
      selectors.push(this.classNames.PROXY_SIZE_CONTAINER_SELECTOR);
    }
    var selector = this.elem.attr('data-parent-container');
    if(selector) {
      selectors.push(this.classNames.PROXY_SIZE_CONTAINER_SELECTOR);
    }
    var container = this.elem.closest(selectors.join());
    if(container.length) {
      parent_elem = container;
    }

    return parent_elem;
  };

  ResponsiveImage.prototype.attachUpdateCallback = function(cb) {
    this.options.updateCallbacks.push(cb);
  };

  ResponsiveImage.prototype.debounce = function(callback, wait) {
    var timeout, result;
    var context = this;
    var args = arguments;
    var later = function () {
      timeout = null;
      result = callback.apply(context, args);
    };
    window.clearTimeout(timeout);
    timeout = window.setTimeout(later, wait);
  };




  ResponsiveImage.prototype.init = function() {

    // add elem to viewportManager
    var parent_elem = this.parentElem;
    this.viewport.add(
      parent_elem,
      function(inExtendedViewport) { if (inExtendedViewport) this.compute(); else this.forgetImage(); }.bind(this),
      function(inViewport) { this.handleInViewport(inViewport); }.bind(this)
    );

    // bind to resize
    $(window).resize(function() { this.handleResize(); }.bind(this));

    // Allow others to recompute/apply focal point.
    this.elem.on('refresh', function() {
      this.compute();
      this.applyFocalPoint();
    }.bind(this));

    this.compute();
    this.applyFocalPoint();
  };

  ResponsiveImage.prototype.handleInViewport = function(elemInViewport) {
    this.setState({ isInViewport: elemInViewport});
    if (elemInViewport) {
      this.applyFocalPoint();
    }
  };

  ResponsiveImage.prototype.forgetImage = function() {
    if (this.viewport.options.forgetImageWhenOutside(this)) {
      this.elem.attr('src', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
      this.viewport.log("Image removed");
      this.setState({isLoaded: false});
    }
  };

  ResponsiveImage.prototype.handleResize = function() {

    this.applyFocalPoint();
    this.debounce(this.compute, 250);
  };

  ResponsiveImage.prototype.findBestMatchingRatio = function(width, height) {
    // find best match
    var min_d = 1000.0;
    var desired_ratio_name;
    var source_ratio = (height !== 0) ? width / height : 1.0;

    $.each(this.options.ratios, function(ndx, elem) {
      if(!desired_ratio_name)
        desired_ratio_name = ndx;
      if (elem.crop) {
        var size = elem.crop;
        ratio = size.width / size.height;

        var delta = Math.abs(source_ratio - ratio);
        if (delta < min_d) {
          desired_ratio_name = ndx;
          min_d = delta;
        }
      }
    });
    return desired_ratio_name;
  };



  ResponsiveImage.prototype.compute = function() {

    var parent_elem = this.parentElem;

    if (!this.viewport.inExtendedViewport(parent_elem))
      return;

    /*
    var now = new Date().getMilliseconds();
    console.log("compute ", now - this.lastComputed);
    this.lastComputed = now;
    */

    var cs = {
      width: parent_elem.width(),
      height: parent_elem.height()
    };

    if((cs.width === 0))
      return;
    //console.log(this.options);

    var desired_ratio = this.findBestMatchingRatio(cs.width, cs.height);
    var interpolation = this.options.ratios[desired_ratio].interpolation;

    // we need to ajust the width and the height, as the image might be scaled
    if(this.mayApplyFocalPoint) {
      var crop = this.options.ratios[desired_ratio].crop;
      var scale = Math.max(cs.width / crop.width, cs.height / crop.height);
      cs.height = Math.round(scale * crop.height);
    }

    var size_key = (desired_ratio === 'ls') ? 'width' : 'height';
    var range_key = (desired_ratio === 'ls') ? 'Width' : 'Height';
    var range = this.options.ratios[desired_ratio];


    var steps = this.options.steps * this.devicePixelRatio;
    var min = this.devicePixelRatio * range['min'+range_key];
    var max = this.devicePixelRatio * range['max'+range_key];
    var current = this.devicePixelRatio * cs[size_key];

    if (min != max) {
      if (this.viewport.options.allowUpScaling(this)) {
        current = Math.round((current-min) / steps) * steps + min;
      }
      else {
        current  = Math.ceil((current-min) / steps) * steps + min;
      }
      current = min + interpolation((current - min) / (max - min)) * (max - min);
    }
    current = Math.min(Math.max(Math.round(current / 10.0) * 10, min), max);

    //console.log(cs.width,cs.height,current, min, max, desired_ratio);

    var new_src = this.getPresetUrl(desired_ratio, current, cs);
    this.requestNewImage(new_src);
  };

  ResponsiveImage.prototype.setState = function(obj) {
    var on, off;
    var that = this;
    var states = {
      isLoading: {
        on: (this.firstImage) ? this.classNames.STATE.IS_INITIAL_LOADING : this.classNames.STATE.IS_LOADING,
        off: this.classNames.STATE.IS_LOADED
      },
      isLoaded: {
        on: this.classNames.STATE.IS_LOADED,
        off: [this.classNames.STATE.IS_INITIAL_LOADING,this.classNames.STATE.ISLOADING].join(' ')
      },
      isInViewport: {
        on: this.classNames.STATE.IS_IN_VIEWPORT,
        off: false
      }
    };

    jQuery.each(obj, function(key, value) {
      if (key in states) {
        var state = states[key];
        var on = value ? state.on : state.off;
        var off = value ? state.off : state.on;
        if (on) {
          that.elem.addClass(on);
        }
        if (off) {
          that.elem.removeClass(off);
        }
        // console.log(key, value, on, off);
      }
      else {
        // console.log("unknown state: ", key);
      }
    });
  };


  ResponsiveImage.prototype.handleImageLoaded = function(image) {
    var $img = $(image);
    this.elem.attr('src', $img.attr('src'));
    this.imageWidth = $img[0].width;
    this.imageHeight = $img[0].height;
    this.viewport.log("Image loaded", this.imageWidth, this.imageHeight, $img);

    this.setState({isLoaded: true});
    this.applyFocalPoint();
    this.temp_image = null;

    this.elem.trigger({
      type: "responsiveImageReady",
      image: this.elem,
      first: this.firstImage
    });

    this.firstImage = false;
  };


  ResponsiveImage.prototype.requestNewImage = function(new_src) {
    if(new_src != this.currentSrc) {
      this.currentSrc = new_src;
      this.setState({isLoading: true});

      if(this.temp_image) {
        // console.log("removing prev temp image");
        this.temp_image.removeAttr("src");
        this.temp_image = null;
      }
      var that = this;
      var temp_image = $('<img>').load(function() {
        that.handleImageLoaded(this);
      }).attr('src', this.viewport.alterSrc(new_src));
      this.temp_image = temp_image;
    }
  };

  ResponsiveImage.prototype.getPresetUrl = function(ratio, size, viewport) {
    var fn = this.viewport.getPresetFunc();
    if (fn) {
      return fn.apply(this, [ratio, size, viewport]);
    }

    var path = Drupal.settings.basePath + Drupal.settings.responsive_image_styles.file_path + '/styles/' + this.options.style + '_' + ratio + '_' + this.options.type + '_' + size + '/public/';
    return this.options.src.replace('public://', path);
  };

  ResponsiveImage.prototype.applyFocalPoint = function() {
    var par_w, par_h, new_w, new_h;

    par_w = this.parentElem.width();
    par_h = this.parentElem.height();

    if ((par_w === undefined) || (par_h === undefined)) {
      // console.log('parent-container undefined');
      return;
    }
    if (!this.mayApplyFocalPoint || (this.imageWidth === undefined)) {

      if (this.options.full_width) {
        if(this.firstImage) {
          var ar = this.options.full_height / this.options.full_width;
          new_w = Math.min(this.options.full_width, par_w);
          new_h = new_w * ar;
          /*if (new_h > par_h) {
            new_h = par_h;
            new_w = par_h * this.options.aspectRatio; 
          }*/
          this.elem.css({width: Math.round(new_w), height: Math.round(new_h)});
        }
        else {
          this.elem.css({width: '', height: ''});
        }
      }

      return;
    }


    var img_w = this.imageWidth;
    var img_h = this.imageHeight;

    this.viewport.log("apply focal point", this.options.src, "image: " + img_w + "x" + img_h, "parent: " + par_w + "x" + par_h);

    var scale = Math.max(par_w / img_w, par_h / img_h);
    new_w = Math.ceil(scale * img_w);
    new_h = Math.ceil(scale * img_h);

    var dx = Math.round((par_w - new_w) * this.options.focalPoint.x / 100.0);
    var dy = Math.round((par_h - new_h) * this.options.focalPoint.y / 100.0);

    this.elem.css({left: dx, top: dy, width: new_w, height: new_h});

    $.each(this.options.updateCallbacks, function(index, elem) {
      elem();
    });

  };

})(jQuery);
