/**
 * Base Class handling viewport image loading.
 */

/**
 *  Helper to check for mobile device.
 */
function isMobileDevice() {
  if (navigator.userAgent.match(/Android/i) || navigator.userAgent.match(/webOS/i) || navigator.userAgent.match(/iPhone/i) || navigator.userAgent.match(/iPad/i) || navigator.userAgent.match(/iPod/i) || navigator.userAgent.match(/BlackBerry/i) || navigator.userAgent.match(/Windows Phone/i)) {
    return true;
  } else {
    return false;
  }
}


(function ($, window, document) {

  /**
   * ViewportSingleton, checks a list of elements if they are in the viewport or not
   * will call a callback, if an element enters the viewport or leave it.
   */
  ViewportSingleton = function(options) {
    this.options = {
      threshold: 2,
      disableOnMobile: true,
      disabled: false,
      debug: false,
      getPresetFunc: false,
      alterSrcFunc: false,
      forgetImageWhenOutside: function() { return false; },
      allowUpScaling: isMobileDevice
    };

    $.extend(this.options, options);

    this.elements = [];
    this.elementsInViewport = [];
    this.init();
  };



  ViewportSingleton.prototype.resolveFunc = function(funcname) {
    if (this.options[funcname] && (typeof this.options[funcname] !== 'function')) {
      var o = window;
      var keys = this.options[funcname].split('.');
      $.each(keys, function(index, key) {
        o = o ? o[key] : false;
      });
      if (o && typeof o === 'function') {
        this.options[funcname] = o;
      }
      else {
        console.log('Cold not resolve ' + funcname + ': ' + this.options[funcname]);
        this.options[funcname] = false;
      }
    }

  }


  /**
   * init
   */
  ViewportSingleton.prototype.init = function() {

    $(document).bind("ready", function() { this.update(); }.bind(this));
    $(window).bind("resize", function() { this.update(); }.bind(this));
    $(window).bind("scroll", function() { this.update(); }.bind(this));

    $(document).on('viewportUpdate', function() {
      this.resetStateAndUpdate();
    }.bind(this));

    this.resolveFunc('getPresetFunc');
    this.resolveFunc('alterSrcFunc');



    this.setDebugEnabled(this.options.debug);
  };

  /**
   * add an element to the list of observed elements
   */
  ViewportSingleton.prototype.add = function(elem, loadFn, inViewportFn) {
    if(this.options.disableOnMobile && isMobileDevice() ) {
      elem.data('inExtendedViewport', true);
      elem.data('inViewport', true);
      loadFn(true);
      this.elements.push({ elem: elem, inViewport: false, loadFn: loadFn, inViewportFn: inViewportFn});
    }
    else {
      this.elements.push({ elem: elem, inViewport: false, loadFn: loadFn, inViewportFn: inViewportFn});
      elem.data('inExtendedViewport', false);
      elem.data('inViewport', false);
    }
  };

  /**
   * Reset stored state and update.
   */
  ViewportSingleton.prototype.resetStateAndUpdate = function() {
    this.resetRecordedVisibiltyState();
    this.update();
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
      var inViewport = false;
      var inExtendedViewport = false;

      if (that.options.disabled) {
        inViewport = true;
        inExtendedViewport = true;
      }
      else {
        // check extended viewport, load image, if necessary
        if ((o.left > r + tx) || (o.top > b + ty) || ( o.left + elementWidth < l - tx) || (o.top + elementHeight < t - ty)) {
          inExtendedViewport = false;
        }
        else {
          inExtendedViewport = true;
        }

        // check viewport
        if ((o.left > r) || (o.top > b) || ( o.left + elementWidth < l) || (o.top + elementHeight < t)) {
          inViewport = false;
        }
        else {
          inViewport = true;
        }
      }

      if (!inExtendedViewport) {
        elem.data('inExtendedViewport', false);
        if (data.inExtendedViewport) {
          data.loadFn(false);
        }
        data.inExtendedViewport = false;
      } else {

        // in viewport
        elem.data('inExtendedViewport', true);
        if (!data.inExtendedViewport) {
          // console.log('new in extended viewport, calling fn');
          data.loadFn(true);
        }
        data.inExtendedViewport = true;
      }
      if (!inViewport) {
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

  ViewportSingleton.prototype.getCSSName = function(key) {
    var that = this;
    if (key instanceof Array) {
      var result = [];
      jQuery.each(key, function(index, elem) {
        result.push(that.getCSSName(elem));
      });
      return result.join(' ');
    }
    else {
      return this.options.cssClasses[key];
    }
  };

  ViewportSingleton.prototype.disable = function() {
    this.options.disabled = true;
    this.update();
  };

  ViewportSingleton.prototype.setDebugEnabled = function(debugEnabled) {
    this.options.debug = debugEnabled;
    if (this.options.debug) {
      ViewportSingleton.prototype.log = function() { console.log.apply(console, arguments); };
    }
    else {
      ViewportSingleton.prototype.log= function() {};
    }
  };


  ViewportSingleton.prototype.getDevicePixelRatio = function() {
    var ratio = 1;

    if (typeof window.devicePixelRatio !== 'undefined') {
      ratio = window.devicePixelRatio >= 1.5 ? 2 : 1;
    }
    return ratio;
  };


  ViewportSingleton.prototype.getPresetFunc = function() {
    return this.options.getPresetFunc;
  };

  ViewportSingleton.prototype.alterSrc = function(src) {
    return this.options.alterSrcFunc ? this.options.alterSrcFunc(src) : src;
  };





})(jQuery, window, document);
