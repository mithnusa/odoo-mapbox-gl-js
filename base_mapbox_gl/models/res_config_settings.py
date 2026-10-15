from odoo import fields, models

MAPBOX_STYLES = [
    # Standard v2 (Recommended)
    ('mapbox://styles/mapbox/standard', 'Standard'),
    ('mapbox://styles/mapbox/standard-satellite', 'Standard Satellite'),
    # Classic Styles
    ('mapbox://styles/mapbox/streets-v12', 'Streets'),
    ('mapbox://styles/mapbox/outdoors-v12', 'Outdoors'),
    ('mapbox://styles/mapbox/light-v11', 'Light'),
    ('mapbox://styles/mapbox/dark-v11', 'Dark'),
    (
        'mapbox://styles/mapbox/satellite-streets-v12',
        'Satellite Streets (Hybrid)',
    ),
    # Navigation Styles
    ('mapbox://styles/mapbox/navigation-day-v1', 'Navigation Day'),
    ('mapbox://styles/mapbox/navigation-night-v1', 'Navigation Night'),
    # OSM Tiles
    ('osm-tiles', 'OpenStreetMap Layer'),
]


MAPBOX_LANGUAGES = [
    ('ar', 'Arabic'),
    ('my', 'Burmese'),
    ('cs', 'Czech'),
    ('da', 'Danish'),
    ('eo', 'Esperanto'),
    ('gl', 'Galician'),
    ('de', 'German'),
    ('el', 'Greek'),
    ('en', 'English (US)'),
    ('en-GB', 'English (UK)'),
    ('es', 'Spanish'),
    ('fi', 'Finnish'),
    ('fr', 'French'),
    ('he', 'Hebrew'),
    ('hu', 'Hungarian'),
    ('id', 'Indonesian'),
    ('it', 'Italian'),
    ('ja', 'Japanese'),
    ('ko', 'Korean'),
    ('nl', 'Dutch'),
    ('no', 'Norwegian'),
    ('pl', 'Polish'),
    ('pt-BR', 'Portuguese (Brazil)'),
    ('pt-PT', 'Portuguese (Portugal)'),
    ('ro', 'Romanian'),
    ('ru', 'Russian'),
    ('sk', 'Slovak'),
    ('sl', 'Slovenian'),
    ('sv', 'Swedish'),
    ('th', 'Thai'),
    ('tr', 'Turkish'),
    ('uk', 'Ukrainian'),
    ('vi', 'Vietnamese'),
    ('zh-Hans', 'Simplified Chinese'),
    ('zh-Hant', 'Traditional Chinese'),
    ('yo', 'Yoruba'),
]


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    mapbox_gl_access_token = fields.Char(
        string='Access Token',
        config_parameter='base_mapbox_gl.access_token',
    )

    mapbox_gl_style_url = fields.Char(
        string='Style',
        config_parameter='base_mapbox_gl.style_url',  # Default style URL
    )

    mapbox_gl_style = fields.Selection(
        selection=MAPBOX_STYLES,
        string='Map Style URL',
        config_parameter='base_mapbox_gl.style',
        default=MAPBOX_STYLES[0][0],  # Default to the first style in the list
    )

    mapbox_gl_lighting = fields.Selection(
        selection=[
            ('dawn', 'Dawn'),
            ('day', 'Day'),
            ('dusk', 'Dusk'),
            ('night', 'Night'),
        ],
        string='Lighting',
        default='day',
        config_parameter='base_mapbox_gl.lighting',
    )

    mapbox_gl_theme = fields.Selection(
        selection=[
            ('default', 'Default'),
            ('faded', 'Faded'),
            ('monochrome', 'Monochrome'),
        ],
        string='Theme',
        default='default',
        config_parameter='base_mapbox_gl.theme',
    )

    mapbox_gl_projection = fields.Selection(
        selection=[
            ('mercator', 'Mercator'),
            ('globe', 'Globe'),
        ],
        string='Projection',
        default='globe',
        config_parameter='base_mapbox_gl.projection',
    )

    mapbox_gl_language = fields.Selection(
        selection=MAPBOX_LANGUAGES,
        string='Language',
        default='en',
        config_parameter='base_mapbox_gl.language',
    )

    def set_values(self):
        # If a custom style URL is set, it takes precedence over the preset style
        style_url = self.mapbox_gl_style_url
        if style_url and self.mapbox_gl_style:
            self.mapbox_gl_style = False
        elif not style_url and not self.mapbox_gl_style:
            self.mapbox_gl_style = MAPBOX_STYLES[0][
                0
            ]  # Default to the first style in the list
        return super().set_values()
