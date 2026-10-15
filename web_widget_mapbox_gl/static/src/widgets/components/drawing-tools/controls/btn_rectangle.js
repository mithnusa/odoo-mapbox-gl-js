import { _t } from '@web/core/l10n/translation';
import { DRAW_RECTANGLE_MODE } from '../utils';

export class RectangleButton {
    constructor(draw, { onBeforeActivate, onActivated, onDeactivated, onError } = {}) {
        this._draw = draw;
        this._onBeforeActivate = onBeforeActivate;
        this._onActivated = onActivated;
        this._onDeactivated = onDeactivated;
        this._onError = onError;
        this.el = this._createElement();
    }

    _createElement() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mapbox-gl-draw_ctrl-draw-btn mapbox-gl-draw_rectangle';
        btn.title = _t('Draw Rectangle - Click one corner then click the opposite corner');
        btn.setAttribute('aria-label', _t('Draw Rectangle'));
        const icon = document.createElement('span');
        icon.className = 'fa fa-square-o';
        icon.style.fontSize = '15px';
        btn.appendChild(icon);
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        });
        return btn;
    }

    toggle() {
        this.el.classList.contains('active') ? this.deactivate() : this.activate();
    }

    activate() {
        this._onBeforeActivate?.();
        try {
            this._draw.changeMode(DRAW_RECTANGLE_MODE);
        } catch (error) {
            this.el.classList.remove('active');
            this._onError?.(error?.message || _t('Failed to activate rectangle drawing mode. Please try again.'));
            return;
        }
        this.el.classList.add('active');
        this._onActivated?.();
    }

    deactivate() {
        if (!this.el.classList.contains('active')) return;
        this.el.classList.remove('active');
        this._onDeactivated?.();
    }

    syncToMode(mode) {
        this.el.classList.toggle('active', mode === DRAW_RECTANGLE_MODE);
    }
}
