/**
 * Base Class handling responsive images via drupal image styles
 */

(function ($) {

  RI_CLASSNAMES = {
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
  ResponsiveImage = function(elem, options) {
    this.elem = elem;
    this.classNames = options.classNames;
    this.elem.addClass(this.classNames.IMAGE);
    this.options = options;

    this.devicePixelRatio = this.getDevicePixelRatio();
    this.mayApplyFocalPoint = this.elem.parent().hasClass(this.classNames.WRAPPER);
    this.firstImage = true;
    this.imageWidth = this.imageHeight = 1;
    if (this.options)
      this.init();
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


  ResponsiveImage.prototype.getDevicePixelRatio = function() {
    var ratio = 1;

    if (typeof window.devicePixelRatio !== 'undefined') {
      ratio = window.devicePixelRatio;
    }
    return ratio;
  };


  ResponsiveImage.prototype.init = function() {

    // add elem to viewportManager
    var parent_elem = this.elem.parent();
    Drupal.viewportSingleton.add( parent_elem, function() { this.compute(); }.bind(this), function(inViewport) { this.handleInViewport(inViewport); }.bind(this));


    // bind to resize
    $(window).resize(function() { this.handleResize(); }.bind(this));

    this.compute();
    this.applyFocalPoint();
  };

  ResponsiveImage.prototype.handleInViewport = function(elemInViewport) {
    this.setState({ isInViewport: elemInViewport});
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

    var parent_elem = this.elem.parent();

    if (!Drupal.viewportSingleton.inExtendedViewport(parent_elem))
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

    // we need to ajust the width and the height, as the image might be scaled
    if(this.mayApplyFocalPoint) {
      var crop = this.options.ratios[desired_ratio].crop;
      var scale = Math.max(cs.width / crop.width, cs.height / crop.height);
      cs.width = Math.round(scale * crop.width);
      cs.height = Math.round(scale * crop.height);
    }

    var size_key = (desired_ratio === 'ls') ? 'width' : 'height';
    var range_key = (desired_ratio === 'ls') ? 'Width' : 'Height';
    var range = this.options.ratios[desired_ratio];



    var min = range['min'+range_key];
    var max = range['max'+range_key];
    var current = cs[size_key] * this.devicePixelRatio;
    current = Math.round((current-min) / this.options.steps) * this.options.steps + min;
    current = Math.min(Math.max(current, min), max);

    //console.log(cs.width,cs.height,current, min, max, desired_ratio);

    var new_src = this.getPresetUrl(desired_ratio, current);
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
        console.log(key, value, on, off);
      }
      else {
        console.log("unknown state: ", key);
      }
    });
  };

  ResponsiveImage.prototype.requestNewImage = function(new_src) {
    var current_src = this.elem.attr('src');
    if(new_src != current_src) {
      this.setState({isLoading: true});

      if(this.temp_image) {
        // console.log("removing prev temp image");
        this.temp_image.removeAttr("src");
        this.temp_image = null;
      }
      var temp_image = $('<img>').load(function() {
        this.elem.attr('src', temp_image.attr('src'));
        this.imageWidth = temp_image[0].width;
        this.imageHeight = temp_image[0].height;
        // console.log(this.imageWidth, this.imageHeight, temp_image);

        $.event.trigger({
          type: "responsiveImageReady",
          image: this.elem,
          first: this.firstImage
        });

        this.firstImage = false;
        this.setState({isLoaded: true});
        this.applyFocalPoint();



      }.bind(this)).attr('src', new_src);
      this.temp_image = temp_image;
    }
  };

  ResponsiveImage.prototype.getPresetUrl = function(ratio, size) {
    var path = Drupal.settings.basePath + Drupal.settings.responsive_image_styles.file_path + '/styles/' + this.options.style + '_' + ratio + '_' + this.options.type + '_' + size + '/public/';
    return this.options.src.replace('public://', path);
  };

  ResponsiveImage.prototype.applyFocalPoint = function() {
    var par_w, par_h, new_w, new_h;

    par_w = this.elem.parent().width();
    par_h = this.elem.parent().height();

    if ((par_w === undefined) || (par_h === undefined)) {
      // console.log('parent-container undefined');
      return;
    }

    if (!this.mayApplyFocalPoint || (this.imageWidth === undefined)) {

      if (this.options.full_width) {
        if(this.firstImage) {
          var ar = this.options.full_height / this.options.full_width;
          new_w = par_w;
          new_h = par_w * ar;
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

    // console.log("apply focal point", this.options.src, img_w, img_h, par_w, par_h);

    var scale = Math.max(par_w / img_w, par_h / img_h);
    new_w = Math.ceil(scale * img_w);
    new_h = Math.ceil(scale * img_h);

    var dx = Math.round((par_w - new_w) * this.options.focalPoint.x / 100.0);
    var dy = Math.round((par_h - new_h) * this.options.focalPoint.y / 100.0);

    // console.log('d', dx, dy,'new', new_w,new_h, 'scale', scale, 'img', img_w, img_h, 'parent', par_w, par_h, 'fp', this.options.focalPoint);

    this.elem.css({left: dx, top: dy, width: new_w, height: new_h});

    // console.log(this.elem.css('left'), this.elem.css('top'));
  };

})(jQuery);
