# -*- coding: utf-8 -*-
from odoo import fields, models


class IrActionsActWindowView(models.Model):
    _inherit = 'ir.actions.act_window.view'

    view_mode = fields.Selection(
        selection_add=[('mapbox_gl', 'Mapbox')],
        ondelete={'mapbox_gl': 'cascade'},
    )
