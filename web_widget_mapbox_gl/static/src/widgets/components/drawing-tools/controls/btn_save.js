import { _t } from '@web/core/l10n/translation';

export class SaveButton {
    constructor(onClick) {
        this.el = this._createElement(onClick);
    }

    _createElement(onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mapbox-gl-draw_ctrl-draw-btn mapbox-gl-draw_save';
        btn.title = _t('Save Changes');
        btn.setAttribute('aria-label', _t('Save Changes'));
        const icon = document.createElement('span');
        icon.className = 'oi';
        icon.setAttribute('data-icon', 'save');
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
     * Toggle the unsaved-changes flash highlight on the button and map container.
     * @param {boolean} on
     * @param {HTMLElement|null} mapContainer
     */
    setHighlighted(on, mapContainer) {
        this.el.classList.toggle('animation-flash-highlight', on);
        if (mapContainer) {
            mapContainer.classList.toggle('has-unsaved-changes', on);
        }
    }
}
