import { _t } from '@web/core/l10n/translation';
import { POLYGON_CUT_MODE } from '../custom_mode_polygon_cut';

export class CutButton {
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
        btn.className = 'mapbox-gl-draw_ctrl-draw-btn mapbox-gl-draw_cut';
        btn.title = _t('Cut Polygon - Draw a polygon to cut existing polygons');
        btn.setAttribute('aria-label', _t('Cut Polygon'));

        const icon = document.createElement('span');
        icon.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="6" cy="6" r="3"/>
            <circle cx="6" cy="18" r="3"/>
            <line x1="20" y1="4" x2="8.12" y2="15.88"/>
            <line x1="14.47" y1="14.48" x2="20" y2="20"/>
            <line x1="8.12" y1="8.12" x2="12" y2="12"/>
        </svg>`;
        icon.style.display = 'flex';
        icon.style.alignItems = 'center';
        icon.style.justifyContent = 'center';
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
            this._draw.changeMode(POLYGON_CUT_MODE);
        } catch (error) {
            this.el.classList.remove('active');
            this._onError?.(error?.message || _t('Please select a polygon to cut and try again.'));
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
        this.el.classList.toggle('active', mode === POLYGON_CUT_MODE);
    }
}
