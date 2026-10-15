import { _t } from '@web/core/l10n/translation';

export class MeasureToggleButton {
    constructor(onClick) {
        this.el = this._createElement(onClick);
    }

    _createElement(onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mapbox-gl-draw_ctrl-draw-btn mapbox-gl-draw_toggle-measurements';
        btn.title = _t('Toggle Measurements');
        btn.setAttribute('aria-label', _t('Toggle Measurements'));
        const icon = document.createElement('span');
        icon.className = 'fa fa-eye-slash';
        icon.style.fontSize = '15px';
        btn.appendChild(icon);
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        });
        return btn;
    }

    /**
     * Update button appearance based on measurement state.
     * @param {boolean} enabled    Whether measurements are currently shown
     * @param {boolean} suspended  Whether to grey out the button (draw/edit mode active)
     */
    setState(enabled, suspended) {
        const icon = this.el.querySelector('span');
        if (suspended) {
            this.el.disabled = true;
            this.el.style.opacity = '0.35';
            this.el.classList.remove('active');
        } else {
            this.el.disabled = false;
            this.el.style.opacity = '';
            this.el.classList.toggle('active', enabled);
            if (icon) icon.className = enabled ? 'fa fa-eye' : 'fa fa-eye-slash';
            if (icon) icon.style.fontSize = '15px';
        }
    }
}
