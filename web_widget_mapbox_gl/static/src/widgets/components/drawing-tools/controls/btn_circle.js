import { _t } from '@web/core/l10n/translation';
import { DRAW_CIRCLE_MODE } from '../utils';

export class CircleButton {
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
        btn.className = 'mapbox-gl-draw_ctrl-draw-btn mapbox-gl-draw_circle';
        btn.title = _t('Draw Circle - Click center then click to set radius');
        btn.setAttribute('aria-label', _t('Draw Circle'));
        const icon = document.createElement('span');
        icon.className = 'oi';
        icon.setAttribute('data-icon', 'circle');
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
            this._draw.changeMode(DRAW_CIRCLE_MODE);
        } catch (error) {
            this.el.classList.remove('active');
            this._onError?.(error?.message || _t('Failed to activate circle drawing mode. Please try again.'));
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
        this.el.classList.toggle('active', mode === DRAW_CIRCLE_MODE);
    }
}
