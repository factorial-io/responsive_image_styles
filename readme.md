# Responsive Image Styles for Drupal

This module will provide responisve image styles to drupal. It is based on the idea of element-queries, where the available width and height of an element defines the image to display.

## How it works
1. You declare your responsive image styles in an implementation of `hook_responsive_styles` (The module has 2 basic styles)
2. The module will create a set of native drupal image styles from the responsive image style.
3. Set the display formatter for your images to “Responsive Image” and choose one of your responsive image styles.
4. When your image gets displayed, a javascript will compute the needed image-size and load the image accordingly using one of the native image-styles.
5. resizing the viewport or similar actions will trigger a check if there’s the need for a higher or lower-res image.
6. The image’s classes will reflect its state (is-loaded, is-in-viewport, etc), so you can customize the appearance and behaviour via css.
7. This module supports the [focal_point](http://drupal.org/project/focal_point)-Module and displays the image accordingly.

## Two types of behavior: adaptive vs. cropped

**Adaptive** images adapt theis sizes to the available space while retaining their aspect ratio. For this to work the images need a width of 100%. Adaptive images do not support focal points as the whole image is visible and no parts get gropped.

**Cropped** images are displayed in a proprietary sized container and get cropped. The focal-point is used to crop only “unnecessary” parts of the image.

## Defining responsive image styles

t.b.d.

## Public javascript API

Sometimes you’ll need to “inform” the responsive images that the size has changed, and that they should get refreshed. The easiest way is to trigger the “viewportUpdate”-event on the document via

```
  $(document).trigger('viewportUpdate');
```

If you only want to refresh a bunch of images, just trigger the “refresh”-event on them:

```
  $('img').trigger('refresh');
```


## Enabling debug output

just call 
```
  Drupal.viewportSingleton.setDebugEnabled(true);
```


