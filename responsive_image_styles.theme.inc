<?php
/**
 * @file
 * Include for hook_theme.
 */

/**
 * Theming function for the responsive image element.
 */
function theme_responsive_image($vars) {
  module_load_include('inc', 'focal_point', 'focal_point.effects');

  // Add js files.
  drupal_add_js(drupal_get_path('module', 'responsive_image_styles') . '/responsive_image.js');
  // Expose public file path to JS, no private files supported.
  drupal_add_js(array(
    'responsive_image_styles' => array(
      'file_path' => variable_get('file_public_path', 'sites/default/files'),
    ),
  ), 'setting');

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
      'image',
      'image-' . $style,
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
        'style_name' => $noscript_style))
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
    if (isset($style_data[$r]['min_width'])) {
      $json_attributes['ratios'][$r]['minWidth'] = $style_data[$r]['min_width'];
      $json_attributes['ratios'][$r]['maxWidth'] = $style_data[$r]['width'];
    }

    if (isset($style_data[$r]['min_height'])) {
      $json_attributes['ratios'][$r]['minHeight'] = $style_data[$r]['min_height'];
      $json_attributes['ratios'][$r]['maxHeight'] = $style_data[$r]['height'];
    }
    if (isset($style_data['cover']) && ($style_data['cover'])) {
      $crop_data = array(
        'width' => $style_data[$r]['width'],
        'height' => $style_data[$r]['height'],
      );
      $focal_point = focal_point_parse($file['focal_point']);

      $crop_data['x'] = focal_point_effect_calculate_anchor($file['width'], $crop_data['width'], $focal_point['x-offset']);
      $crop_data['y'] = focal_point_effect_calculate_anchor($file['height'], $crop_data['height'], $focal_point['y-offset']);
      $json_attributes['ratios'][$r]['crop'] = $crop_data;
      $json_attributes['ratios'][$r]['resize'] = focal_point_effect_resize_data($file['width'], $file['height'], $crop_data['width'], $crop_data['height']);
    }
    else {
      $json_attributes['full_width'] = $file['width'];
      $json_attributes['full_height'] = $file['height'];
    }
  }

  $attributes = array(
    'alt' => isset($file['alt']) ? $file['alt'] : '',
    'class' => array(
      'image', 'image-' . $style,
      'responsive-image',
      'responsive-image--initial-loading-state',
    ),
    'src' => 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  );

  if (isset($file['title'])) {
    $attributes['title'] = $file['title'];
  }

  if (isset($file['focal_point'])) {
    $fp = focal_point_parse($file['focal_point']);
    $json_attributes['focalPoint'] = array('x' => $fp['x-offset'], 'y' => $fp['y-offset']);
    // We need scaled size and focal-point offset.
    $attributes['class'][] = 'has-focal-point';
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
    $output = '<div class="focal-point-wrapper">' . $output . '</div>';
  }
  return $output;
}
