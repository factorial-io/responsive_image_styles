<?php

/**
 * @file
 * Include for hook_theme.
 */

/**
 * Theming function for the responsive image element.
 */
function theme_responsive_image($vars) {
  static $css_classes = FALSE;

  module_load_include('inc', 'focal_point', 'focal_point.effects');
  // Add js files.
  $path = drupal_get_path('module', 'responsive_image_styles') . '/js/';
  drupal_add_js($path . 'viewport.js', array('weight' => 1));
  drupal_add_js($path . 'responsive_image.js', array('weight' => 2));
  drupal_add_js($path . 'responsive_image_styles.js', array('weight' => 3));

  ctools_add_css('responsive_image_styles', 'responsive_image_styles');

  if (!$css_classes) {
    $css_classes = responsive_images_get_css_class_names();
    // Expose public file path to JS, no private files supported.
    drupal_add_js(array(
      'responsive_image_styles' => array(
        'file_path' => variable_get('file_public_path', 'sites/default/files'),
        'classNames' => $css_classes,
      ),
    ), 'setting');
  }

  $styles = responsive_image_styles_get_base_styles();
  $style = $vars['style'];
  $file = (array) $vars['file'];

  if (!isset($file['uri'])) {
    return '';
  }

  // File width not available, so re-fetch.
  if (!isset($file['width'])) {
    $file = drupal_array_merge_deep($file, image_get_info($file['uri']));
  }

  if (!isset($styles[$style])) {
    return '<strong>image preset ' . $style . ' not found!</strong>';
  }

  $style_data = $styles[$style];
  $ratio = $style_data['available_ratios'][0];
  $noscript_style = _responsive_image_styles_get_style_name($style_data, $ratio, $style_data[$ratio]['noscript']);
  $noscript_file = $file;

  $noscript_attrs = drupal_array_merge_deep(array(
    'class' => array(
      $css_classes['IMAGE'],
    ),
  ),
    $vars['attributes']
  );
  unset($noscript_attrs['width']);
  unset($noscript_attrs['height']);
  unset($noscript_file['width']);
  unset($noscript_file['height']);

  $output = '<noscript>' . theme(
    'image_style',
    array_merge(
      $noscript_file,
      array(
        'attributes' => $noscript_attrs,
        'path' => $file['uri'],
        'style_name' => $noscript_style,
      ))
    ) . '</noscript>';

  $json_attributes = array(
    'src' => $file['uri'],
    'style' => $style,
    'type' => $style_data['type'],
    'steps' => isset($style_data['step_width']) ? $style_data['step_width'] : RESPONSIVE_IMAGE_STYLES_STEPS,
    'ratios' => array(),
  );

  foreach ($style_data['available_ratios'] as $r) {
    $json_attributes['ratios'][$r] = array();
    $json_attributes['ratios'][$r]['interpolation'] = $style_data[$r]['interpolation'];

    if (isset($style_data[$r]['min_width'])) {
      $json_attributes['ratios'][$r]['minWidth'] = $style_data[$r]['min_width'];
      $json_attributes['ratios'][$r]['maxWidth'] = $style_data[$r]['width'];
    }

    if (isset($style_data[$r]['min_height'])) {
      $json_attributes['ratios'][$r]['minHeight'] = $style_data[$r]['min_height'];
      $json_attributes['ratios'][$r]['maxHeight'] = $style_data[$r]['height'];
    }
    if (isset($style_data['cover']) && ($style_data['cover'])) {
      $focal_point = focal_point_parse($file['focal_point']);
      if (empty($focal_point)) {
        $focal_point = FOCAL_POINT_DEFAULT;
      }
      $crop_data = _responsive_image_styles_compute_crop($file, $style_data['type'], $style_data[$r], $focal_point);

      $json_attributes['ratios'][$r]['crop'] = $crop_data;
    }
    $json_attributes['full_width'] = $file['width'];
    $json_attributes['full_height'] = $file['height'];
  }

  $classes = array(
    $css_classes['IMAGE'],
    $css_classes['IMAGE'] . '--' . $style,
  );
  if (!$style_data['cover']) {
    $classes[] = $css_classes['IMAGE'] . '--' . ($file['width'] > $file['height'] ? 'landscape' : 'portrait'
    );
  }

  $attributes = array(
    'alt' => isset($file['alt']) ? $file['alt'] : '',
    'src' => 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'class' => implode(' ', $classes),
  );

  if (isset($file['title'])) {
    $attributes['title'] = $file['title'];
  }

  if (isset($file['focal_point'])) {
    $fp = focal_point_parse($file['focal_point']);
    $json_attributes['focalPoint'] = array('x' => $fp['x-offset'], 'y' => $fp['y-offset']);
  }

  if (!empty($vars['data_options'])) {
    $json_attributes = drupal_array_merge_deep($vars['data_options'], $json_attributes);
  }
  $attributes['data-responsive-image'] = json_encode($json_attributes);

  foreach (array('width', 'height') as $key) {
    if (isset($vars[$key])) {
      $attributes[$key] = $vars[$key];
    }
  }

  $attributes = drupal_array_merge_deep($attributes, $vars['attributes']);
  $output .= '<img ' . drupal_attributes($attributes) . '/>';
  if ($style_data['cover']) {
    $output = '<div class="' . $css_classes['WRAPPER'] . '">' . $output . '</div>';
  }
  elseif (!empty($css_classes['SIMPLE_IMAGE_WRAPPER'])) {
    $output = '<div class="' . $css_classes['SIMPLE_IMAGE_WRAPPER'] . '">' . $output . '</div>';
  }
  return $output;
}
