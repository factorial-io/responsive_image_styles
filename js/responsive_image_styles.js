'use strict';
(function ($, window, document, undefined) {

  window.Drupal.behaviors.responsiveImages = {

    classNames: null,

    attachImage: function(img) {
      var $img = $(img);
      var options = JSON.parse($img.attr('data-responsive-image'));
      var mri; // REVIEW: What is 'mri'? my responsive image?

      options.classNames = this.classNames;
      mri = new window.ResponsiveImage($img, options);
      $img.data('mri', mri);
    },

    attach: function (context) {

      var isHandledClass;

      // create singleton:
      if (!window.Drupal.viewportSingleton) {
        window.Drupal.viewportSingleton = new window.ViewportSingleton();
      }

      // get class-names from Drupal settings
      // REVIEW: default and options extension.
      if (!this.classNames) {
        this.classNames = window.RI_CLASSNAMES;
        if (window.Drupal.settings.responsive_image_styles.classNames) {
          $.extend(
            this.classNames,
            window.Drupal.settings.responsive_image_styles.classNames
          );
        }
      }

      isHandledClass = this.classNames.STATE.ELEMENT_IS_HANDLED;

      $('img[data-responsive-image]:not(.' + isHandledClass + ')', context)
        .addClass(isHandledClass)
        .each($.proxy(function(index, element) {
          this.attachImage(element);
        }, this));

      window.Drupal.viewportSingleton.update(); // Check viewport.
    }
  };
})(jQuery, window, document);
