import { _t } from '@web/core/l10n/translation';

export class DrawPolygonButton {
    constructor(draw, { onBeforeActivate, onDeactivated } = {}) {
        this._draw = draw;
        this._onBeforeActivate = onBeforeActivate;
        this._onDeactivated = onDeactivated;
        this.el = this._createElement();
    }

    _createElement() {
        const btn = document.createElement('button');
        btn.type = 'button';
        // Use MapboxDraw's own CSS class — its stylesheet provides the polygon icon
        btn.className = 'mapbox-gl-draw_ctrl-draw-btn mapbox-gl-draw_polygon';
        btn.title = _t('Draw Polygon');
        btn.setAttribute('aria-label', _t('Draw Polygon'));
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
        this._draw.changeMode('draw_polygon');
        this.el.classList.add('active');
    }

    deactivate() {
        if (!this.el.classList.contains('active')) return;
        this.el.classList.remove('active');
        this._onDeactivated?.();
    }

    syncToMode(mode) {
        this.el.classList.toggle('active', mode === 'draw_polygon');
    }
}
