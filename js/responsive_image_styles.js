(function ($) {

/**
 * Base Class handling viewport image loading.
 */

/**
 *  Helper to check for mobile device.
 */
function isMobileDevice() {
  if( navigator.userAgent.match(/Android/i) || navigator.userAgent.match(/webOS/i) || navigator.userAgent.match(/iPhone/i) || navigator.userAgent.match(/iPad/i) || navigator.userAgent.match(/iPod/i) || navigator.userAgent.match(/BlackBerry/i) || navigator.userAgent.match(/Windows Phone/i)
   )
  {
    return true;
  }
 else {
    return false;
  }
}



  /**
   * ViewportSingleton, checks a list of elements if they are in the viewport or not
   * will call a callback, if an element enters the viewport the first time
   */
  //var ViewportSingleton = function(options) {
  ViewportSingleton = function(options) {
    this.options = options;
    this.elements = [];
    this.elementsInViewport = [];
    this.init();
  };


  /**
   * init
   */
  ViewportSingleton.prototype.init = function() {

    $(document).bind("ready", function() { this.update(); }.bind(this));
    $(window).bind("resize", function() { this.update(); }.bind(this));
    $(window).bind("scroll", function() { this.update(); }.bind(this));

    $(document).on('viewportUpdate', function(event) {
      this.resetRecordedVisibiltyState();
      this.update();
    }.bind(this));
  };

  /**
   * add an element to the list of observed elements
   */
  ViewportSingleton.prototype.add = function(elem, loadFn, inViewportFn) {
    if(this.options.disableOnMobile && isMobileDevice() ) {
      elem.data('inExtendedViewport', true);
      elem.data('inViewport', true);
      loadFn();
      inViewportFn(true);
    }
    else {
      this.elements.push({ elem: elem, inViewport: false, loadFn: loadFn, inViewportFn: inViewportFn});
      elem.data('inExtendedViewport', false);
      elem.data('inViewport', false);
    }
  };

  /**
   * reset the recorded visibility state
   */
  ViewportSingleton.prototype.resetRecordedVisibiltyState = function() {
    $.each(this.elements, function(ndx, data) {
      data.inViewport = false;
      data.inExtendedViewport = false;
    });
  };

  /**
   * query the viewport and check all elements against the viewport
   */
  ViewportSingleton.prototype.update = function() {

    var that = this;

    if (this.elements.length === 0)
      return;

    // compute viewport
    var $window = $(window);
    var tx = (this.options.threshold - 1) * $window.width();
    var ty = (this.options.threshold - 1) * $window.height();

    var l = $window.scrollLeft();
    var t = $window.scrollTop();
    var r = l + $window.width();
    var b = t + $window.height();

    $.each(this.elements, function(ndx, data) {

      var elem = data.elem;
      var o = elem.offset();
      var elementWidth = elem.width();
      var elementHeight = elem.height();

      // check extended viewport, load image, if necessary
      if ((o.left > r + tx) || (o.top > b + ty) || ( o.left + elementWidth < l - tx) || (o.top + elementHeight < t - ty)) {
        elem.data('inExtendedViewport', false);
        data.inExtendedViewport = false;
      } else {

        // in viewport
        elem.data('inExtendedViewport', true);
        if (!data.inExtendedViewport) {
          // console.log('new in extended viewport, calling fn');
          data.loadFn();
        }

        data.inExtendedViewport = true;
      }

      // check viewport
      if ((o.left > r) || (o.top > b) || ( o.left + elementWidth < l) || (o.top + elementHeight < t)) {
        if (data.inViewport) {
          data.inViewportFn(false);
        }
        elem.data('inViewport', false);
        data.inViewport = false;
      } else {

        // in viewport
        elem.data('inViewport', true);
        if (!data.inViewport) {
          // console.log('new in viewport, calling fn');
          data.inViewportFn(true);
        }

        data.inViewport = true;
      }
    });

  };

  /**
   * returns true, if the element is in the viewport.
   * will return true for not registered elements
   */
  ViewportSingleton.prototype.inViewport = function(elem) {
    cached_result = elem.data('inViewport');

    // do we know this element? if not, return true
    if(cached_result === undefined)
      return true;

    return (cached_result ===  true);
  };

  ViewportSingleton.prototype.inExtendedViewport = function(elem) {
    cached_result = elem.data('inExtendedViewport');

    // do we know this element? if not, return true
    if(cached_result === undefined)
      return true;

    return (cached_result ===  true);
  };

  var viewportSingleton = viewportSingleton || new ViewportSingleton({
    threshold: 2,
    disableOnMobile: true,
  });


  /**
   * responsive image class. Will load a new src on size changes
   */
  var ResponsiveImage = function(elem, options) {
    this.elem = elem;
    this.elem.addClass('responsive-image');
    this.options = options;
    this.devicePixelRatio = this.getDevicePixelRatio();
    this.mayApplyFocalPoint = this.elem.parent().hasClass('focal-point-wrapper');
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
    viewportSingleton.add( parent_elem, function() { this.compute(); }.bind(this), function(inViewport) { this.handleInViewport(inViewport); }.bind(this));


    // bind to resize
    $(window).resize(function() { this.handleResize(); }.bind(this));

    this.compute();
    this.applyFocalPoint();
  };

  ResponsiveImage.prototype.handleInViewport = function(elemInViewport) {

    if (elemInViewport) {
      this.elem.addClass('responsive-image--in-viewport-state');
    } else {
      this.elem.removeClass('responsive-image--in-viewport-state');
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

    var parent_elem = this.elem.parent();

    if (!viewportSingleton.inExtendedViewport(parent_elem))
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

  ResponsiveImage.prototype.requestNewImage = function(new_src) {
    var current_src = this.elem.attr('src');
    if(new_src != current_src) {
      if (this.firstImage) {
        this.elem.addClass('responsive-image--initial-loading-state').removeClass('responsive-image--loaded-state');
      }
      else {
        this.elem.addClass('responsive-image--loading-state').removeClass('responsive-image--loaded-state');
      }

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

        this.elem.removeClass('responsive-image--loading-state').removeClass('responsive-image--initial-loading-state').addClass('responsive-image--loaded-state');
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


  Drupal.behaviors.responsiveImages = {

    attachImage: function(img) {
      var $img = $(img);
      var options = JSON.parse($img.attr('data-responsive-image'));
      var mri = new ResponsiveImage($img, options);
      $img.data('mri',mri);
    },

    attach: function (context, settings) {

      $('img[data-responsive-image]:not(.responsive-image-handled)', context).addClass('responsive-image-handled').each(function(ndx, elem) {
        this.attachImage(elem);
      }.bind(this));
    }
  };
})(jQuery);
