// Native <select> and <datalist> popups are OS-level windows rather than part
// of the document. Inside the Chrome side panel they do not work: the popup
// appears, but the click that picks an option never reaches it, so the value
// never changes. Every other control in the panel responds normally, which is
// what rules out the panel's own code and points at the popup itself.
//
// This replaces both with a listbox built from ordinary elements, so picking a
// value is just a click on a div. The original <select> / <input list> stays in
// the DOM as the source of truth, which is what keeps sidepanel.js untouched:
// reads of .value, writes to .value, rebuilt <option> lists and 'change'
// listeners all behave exactly as before.
(function (global) {
    'use strict';

    // Above this many options the list is long enough (model lists run to 20+)
    // that scanning it by eye stops working, so it gets a filter box.
    const FILTER_THRESHOLD = 8;
    const MAX_MENU_HEIGHT = 280;

    const valueDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    const indexDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');

    let live = null;   // the one open menu, if any

    function close() {
        if (!live) return;
        const { anchor, menu } = live;
        live = null;
        menu.remove();
        anchor.setAttribute('aria-expanded', 'false');
        anchor.classList.remove('cs-button-open');
    }

    function place(menu, anchor) {
        const rect = anchor.getBoundingClientRect();
        const gutter = 8;
        menu.style.minWidth = `${rect.width}px`;
        menu.style.maxWidth = `${Math.max(rect.width, window.innerWidth - gutter * 2)}px`;
        menu.style.left = `${rect.left}px`;
        menu.style.top = '0px';
        menu.style.maxHeight = `${MAX_MENU_HEIGHT}px`;

        // Measure only once the constraints above are in place.
        const below = window.innerHeight - rect.bottom - gutter;
        const above = rect.top - gutter;
        if (menu.offsetHeight > below && above > below) {
            menu.style.maxHeight = `${Math.min(MAX_MENU_HEIGHT, above)}px`;
            menu.style.top = `${Math.max(gutter, rect.top - menu.offsetHeight - 4)}px`;
        } else {
            menu.style.maxHeight = `${Math.min(MAX_MENU_HEIGHT, below)}px`;
            menu.style.top = `${rect.bottom + 4}px`;
        }

        const width = menu.getBoundingClientRect().width;
        if (rect.left + width > window.innerWidth - gutter) {
            menu.style.left = `${Math.max(gutter, window.innerWidth - gutter - width)}px`;
        }
    }

    // The listbox itself. `spec` supplies the rows and takes the pick; both the
    // select and the datalist replacements are thin wrappers over this.
    //   items()    -> [{ value, text, disabled }]
    //   needle()   -> current filter text ('' for none)
    //   current()  -> value to mark as selected
    //   pick(item) -> called when the user chooses a row
    function openListbox(anchor, spec) {
        close();

        const menu = document.createElement('div');
        menu.className = 'cs-menu';
        menu.setAttribute('role', 'listbox');

        let filterBox = null;
        if (spec.filterBox) {
            filterBox = document.createElement('input');
            filterBox.type = 'text';
            filterBox.className = 'cs-filter';
            filterBox.placeholder = 'Filter...';
            filterBox.autocomplete = 'off';
            filterBox.addEventListener('input', () => { render(); place(menu, anchor); });
            menu.appendChild(filterBox);
        }

        const list = document.createElement('div');
        list.className = 'cs-options';
        menu.appendChild(list);

        let rows = [];
        let active = -1;

        function paint() {
            rows.forEach((row, i) => row.classList.toggle('cs-active', i === active));
            const row = rows[active];
            if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
        }

        function render() {
            const needle = (filterBox ? filterBox.value : spec.needle()).trim().toLowerCase();
            const selected = spec.current();
            list.textContent = '';
            rows = [];
            active = -1;

            for (const item of spec.items()) {
                if (needle && !item.text.toLowerCase().includes(needle) && !item.value.toLowerCase().includes(needle)) continue;

                const row = document.createElement('div');
                row.className = 'cs-option';
                row.setAttribute('role', 'option');
                row.textContent = item.text;
                row.title = item.text;
                row.item = item;

                if (item.disabled) {
                    row.classList.add('cs-option-disabled');
                    row.setAttribute('aria-disabled', 'true');
                } else {
                    // pointerdown, not click: it beats the blur that would close
                    // the menu, and the document-level dismiss handler fires on
                    // pointerdown too, so a click would arrive too late.
                    row.addEventListener('pointerdown', (event) => {
                        event.preventDefault();
                        spec.pick(item);
                    });
                    row.addEventListener('pointerenter', () => { active = rows.indexOf(row); paint(); });
                }
                if (item.value === selected) {
                    row.classList.add('cs-selected');
                    row.setAttribute('aria-selected', 'true');
                    active = rows.length;
                }
                rows.push(row);
                list.appendChild(row);
            }

            if (!rows.length) {
                const empty = document.createElement('div');
                empty.className = 'cs-empty';
                empty.textContent = 'No matches';
                list.appendChild(empty);
            }
            paint();
        }

        function move(step) {
            if (!rows.length) return;
            let next = active;
            for (let i = 0; i < rows.length; i++) {
                next = (next + step + rows.length) % rows.length;
                if (!rows[next].classList.contains('cs-option-disabled')) break;
            }
            active = next;
            paint();
        }

        function commitActive() {
            const row = rows[active];
            if (!row || !row.item || row.item.disabled) return false;
            spec.pick(row.item);
            return true;
        }

        // Arrow/Enter/Escape, wherever focus happens to be. For a select that is
        // the menu; for a datalist input it stays on the input, which forwards.
        function keys(event) {
            switch (event.key) {
                case 'ArrowDown': event.preventDefault(); move(1); return true;
                case 'ArrowUp': event.preventDefault(); move(-1); return true;
                case 'Home': event.preventDefault(); active = -1; move(1); return true;
                case 'End': event.preventDefault(); active = 0; move(-1); return true;
                case 'Enter': event.preventDefault(); return commitActive();
                case 'Escape':
                case 'Tab':
                    event.preventDefault();
                    close();
                    if (spec.onDismiss) spec.onDismiss();
                    return true;
                default: return false;
            }
        }

        menu.addEventListener('keydown', keys);
        document.body.appendChild(menu);
        live = { anchor, menu, render, keys, refresh: () => { render(); place(menu, anchor); } };

        render();
        place(menu, anchor);
        anchor.setAttribute('aria-expanded', 'true');
        anchor.classList.add('cs-button-open');
        if (filterBox) filterBox.focus();
        return live;
    }

    function optionsOf(container) {
        return Array.from(container.options || container.children).map((option) => ({
            value: option.value,
            text: option.textContent || option.value,
            disabled: !!option.disabled
        }));
    }

    function enhanceSelect(select) {
        if (select.dataset.csEnhanced === '1') return;
        select.dataset.csEnhanced = '1';

        const wrap = document.createElement('div');
        wrap.className = 'cs';
        // Some selects carry their layout inline (flex: 1, to sit beside the
        // reload button). The wrapper takes the select's place in the flow, so
        // it has to take that styling too.
        if (select.hasAttribute('style')) wrap.setAttribute('style', select.getAttribute('style'));
        select.parentNode.insertBefore(wrap, select);
        wrap.appendChild(select);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cs-button';
        button.setAttribute('aria-haspopup', 'listbox');
        button.setAttribute('aria-expanded', 'false');
        const label = document.createElement('span');
        label.className = 'cs-label';
        button.appendChild(label);
        wrap.appendChild(button);

        bindLabel(select, button, () => { if (!select.disabled) toggle(); });

        function sync() {
            const option = select.options[select.selectedIndex];
            const text = option ? option.textContent : '';
            label.textContent = text;
            button.title = text;
            button.disabled = select.disabled;
            wrap.classList.toggle('cs-disabled', select.disabled);
            if (live && live.anchor === button) live.refresh();
        }

        // Programmatic writes are how the model lists land (populateModelSelect
        // rebuilds the options, then assigns .value) and an assignment fires no
        // event of any kind, so the setters have to report it themselves.
        Object.defineProperty(select, 'value', {
            configurable: true,
            get() { return valueDesc.get.call(this); },
            set(v) { valueDesc.set.call(this, v); sync(); }
        });
        Object.defineProperty(select, 'selectedIndex', {
            configurable: true,
            get() { return indexDesc.get.call(this); },
            set(v) { indexDesc.set.call(this, v); sync(); }
        });

        new MutationObserver(sync).observe(select, {
            childList: true, subtree: true, characterData: true, attributes: true
        });

        function toggle() {
            if (live && live.anchor === button) { close(); return; }
            if (select.disabled) return;
            openListbox(button, {
                filterBox: select.options.length > FILTER_THRESHOLD,
                items: () => optionsOf(select),
                needle: () => '',
                current: () => valueDesc.get.call(select),
                onDismiss: () => button.focus(),
                pick: (item) => {
                    const changed = valueDesc.get.call(select) !== item.value;
                    valueDesc.set.call(select, item.value);
                    sync();
                    close();
                    button.focus();
                    // Native selects fire nothing when the value is unchanged.
                    if (!changed) return;
                    select.dispatchEvent(new Event('input', { bubbles: true }));
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        }

        button.addEventListener('click', (event) => { event.preventDefault(); toggle(); });
        button.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggle();
            }
        });

        sync();
    }

    // The model fields are free-text inputs with a <datalist> of suggestions.
    // Same broken popup, so the same treatment - except the input itself is the
    // filter, and any typed value is still allowed.
    function enhanceDatalist(input) {
        if (input.dataset.csEnhanced === '1') return;
        const listId = input.getAttribute('list');
        const source = listId && document.getElementById(listId);
        if (!source) return;
        input.dataset.csEnhanced = '1';

        // Drop the association, or Chrome renders its own popup over ours.
        input.removeAttribute('list');
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('aria-expanded', 'false');
        let quiet = false;

        function items() {
            return optionsOf(source).map((item) => ({ ...item, text: item.text || item.value }));
        }

        function open() {
            if (!items().length || input.disabled || input.readOnly) return;
            openListbox(input, {
                filterBox: false,
                items,
                needle: () => input.value,
                current: () => input.value,
                onDismiss: () => input.focus(),
                pick: (item) => {
                    // `quiet` covers the dispatches as well as the assignment:
                    // our own 'input' event must not be read back as the user
                    // typing, which would reopen the menu we just closed.
                    quiet = true;
                    input.value = item.value;
                    close();
                    input.focus();
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    quiet = false;
                }
            });
        }

        input.addEventListener('focus', () => { if (!quiet) open(); });
        input.addEventListener('click', () => { if (!quiet && (!live || live.anchor !== input)) open(); });
        input.addEventListener('input', () => {
            if (quiet) return;
            if (live && live.anchor === input) live.refresh();
            else open();
        });
        input.addEventListener('keydown', (event) => {
            if (!live || live.anchor !== input) {
                if (event.key === 'ArrowDown') { event.preventDefault(); open(); }
                return;
            }
            live.keys(event);
        });
        input.addEventListener('blur', () => {
            // Row picks run on pointerdown with preventDefault, so a blur here
            // means focus really left the field.
            if (live && live.anchor === input) close();
        });
    }

    function bindLabel(control, target, onClick) {
        // <label for="..."> points at the control, which is hidden now, so the
        // browser's own label forwarding no longer lands anywhere.
        if (!control.id) return;
        const tag = Array.from(document.querySelectorAll('label[for]')).find(l => l.htmlFor === control.id);
        if (!tag) return;
        tag.addEventListener('click', (event) => { event.preventDefault(); onClick(); });
        target.setAttribute('aria-labelledby', tag.id || (tag.id = `${control.id}Label`));
    }

    function enhanceAll(root) {
        const scope = root || document;
        scope.querySelectorAll('select').forEach(enhanceSelect);
        scope.querySelectorAll('input[list]').forEach(enhanceDatalist);
    }

    // Dismissal is global: only one menu is ever open.
    document.addEventListener('pointerdown', (event) => {
        if (!live) return;
        if (live.menu.contains(event.target) || live.anchor.contains(event.target)) return;
        close();
    }, true);
    // Capture, because the scroll that matters happens inside the panel, not on
    // window - and a menu anchored to a button that moved points at nothing.
    window.addEventListener('scroll', (event) => {
        if (live && !live.menu.contains(event.target)) close();
    }, true);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);

    global.CustomSelect = { enhanceSelect, enhanceDatalist, enhanceAll, close };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => enhanceAll());
    } else {
        enhanceAll();
    }
})(self);
