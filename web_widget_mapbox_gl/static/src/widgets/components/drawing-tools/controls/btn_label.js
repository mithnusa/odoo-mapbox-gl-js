import { _t } from '@web/core/l10n/translation';

/**
 * LabelButton — manages label placement mode on the map.
 *
 * Toggle logic:
 *   - If a label feature is currently selected (isEditing), clicking opens the
 *     edit dialog via the onEditSelected callback.
 *   - If label placement is already active, clicking deactivates it.
 *   - Otherwise, clicking activates placement mode: sets the cursor to crosshair
 *     and waits for a single map click to place the label.
 *
 * The dialog that opens after a map click (onPlace) stays in drawing-tools.js
 * because it requires OWL's dialogService.
 */
export class LabelButton {
    constructor(map, draw, { onBeforeActivate, onPlace, onEditSelected } = {}) {
        this._map = map;
        this._draw = draw;
        this._onBeforeActivate = onBeforeActivate;
        this._onPlace = onPlace;
        this._onEditSelected = onEditSelected;
        this._isEditing = false;
        this._clickHandler = null;
        this.el = this._createElement();
    }

    _createElement() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mapbox-gl-draw_ctrl-draw-btn mapbox-gl-draw_add-label';
        btn.title = _t('Add Label - Click button then click the map to place a text label');
        btn.setAttribute('aria-label', _t('Add Label'));
        const icon = document.createElement('span');
        icon.className = 'fa fa-font';
        icon.style.fontSize = '15px';
        btn.appendChild(icon);
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._onButtonClick();
        });
        return btn;
    }

    _onButtonClick() {
        if (this._isEditing) {
            this._onEditSelected?.();
        } else if (this._clickHandler) {
            this.deactivate();
        } else {
            this.activate();
        }
    }

    activate() {
        this._onBeforeActivate?.();
        this._draw.changeMode('simple_select');
        this._map.getCanvas().style.cursor = 'crosshair';
        this._clickHandler = (e) => {
            this.deactivate();
            this._onPlace?.([e.lngLat.lng, e.lngLat.lat]);
        };
        this._map.once('click', this._clickHandler);
        this.el.classList.add('active');
    }

    deactivate() {
        if (!this._clickHandler && !this.el.classList.contains('active')) return;
        this.el.classList.remove('active');
        const canvas = this._map?.getCanvas();
        if (canvas) canvas.style.cursor = '';
        if (this._clickHandler) {
            this._map?.off('click', this._clickHandler);
            this._clickHandler = null;
        }
    }

    /**
     * Switch the button between "Add Label" and "Edit Label" appearance.
     * Called from drawing-tools.js when a label feature is selected/deselected.
     */
    setEditing(isEditing) {
        this._isEditing = isEditing;
        const icon = this.el.querySelector('span');
        if (isEditing) {
            this.el.title = _t('Edit Label');
            this.el.setAttribute('aria-label', _t('Edit Label'));
            if (icon) icon.className = 'fa fa-pencil';
        } else {
            this.el.title = _t('Add Label - Click button then click the map to place a text label');
            this.el.setAttribute('aria-label', _t('Add Label'));
            if (icon) icon.className = 'fa fa-font';
        }
        if (icon) icon.style.fontSize = '15px';
    }
}
