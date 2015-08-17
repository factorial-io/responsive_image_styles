(function ($) {

  Drupal.behaviors.responsiveImages = {

    classNames: null,
    viewport: null,

    attachImage: function(img) {
      var $img = $(img);
      var options = JSON.parse($img.attr('data-responsive-image'));
      options.classNames = this.classNames;
      options.viewport = this.viewport;
      var mri = new ResponsiveImage($img, options);
      $img.data('mri',mri);
    },

    attach: function (context, settings) {
      // create singleton:
      if (!this.viewport) {
        var options = Drupal.settings.responsive_image_styles.viewport_settings || {};
        this.viewport = new ViewportSingleton(options);
      }

      // get class-names from Drupal settings
      if (!this.classNames) {
        this.classNames = RI_CLASSNAMES;
        if (Drupal.settings.responsive_image_styles.classNames) {
          jQuery.extend(this.classNames, Drupal.settings.responsive_image_styles.classNames);
        }
      }

      var isHandledClass = this.classNames.STATE.ELEMENT_IS_HANDLED;
      $('img[data-responsive-image]:not(.'+isHandledClass+')', context).addClass(isHandledClass).each(function(ndx, elem) {
        this.attachImage(elem);
      }.bind(this));

      // Check viewport.
      this.viewport.update();

      // Be backwards compatible, older versions used a singleton.
      Drupal.viewportSingleton = this.viewport;
    }
  };
})(jQuery);
