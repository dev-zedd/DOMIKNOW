(function () {
    'use strict';

    const TYPE_LABELS = Object.freeze({
        property: 'Property experience',
        landlord: 'Landlord experience',
        rental_experience: 'Rental journey'
    });

    function clampRating(value) {
        return Math.min(5, Math.max(0, Number(value) || 0));
    }

    function starsFor(value) {
        const rounded = Math.round(clampRating(value));
        return `${'★'.repeat(rounded)}${'☆'.repeat(5 - rounded)}`;
    }

    function feedbackDate(value) {
        if (!value) return 'Verified lease experience';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Verified lease experience';
        return `Shared ${new Intl.DateTimeFormat('en-PH', { month: 'short', year: 'numeric' }).format(date)}`;
    }

    function createFeedbackCard(item) {
        const rating = clampRating(item.rating);
        const card = document.createElement('article');
        card.className = 'public-feedback-card';

        const header = document.createElement('div');
        header.className = 'public-feedback-card__header';

        const identity = document.createElement('div');
        identity.className = 'public-feedback-card__identity';
        const mark = document.createElement('span');
        mark.className = 'public-feedback-card__mark';
        mark.setAttribute('aria-hidden', 'true');
        mark.innerHTML = window.domiknowIcon ? window.domiknowIcon('shield') : '✓';
        const identityCopy = document.createElement('span');
        const identityTitle = document.createElement('strong');
        identityTitle.textContent = 'Verified tenant';
        const identityMeta = document.createElement('small');
        identityMeta.textContent = feedbackDate(item.submitted_at);
        identityCopy.append(identityTitle, identityMeta);
        identity.append(mark, identityCopy);

        const score = document.createElement('span');
        score.className = 'public-feedback-card__score';
        score.textContent = rating.toFixed(1);
        score.setAttribute('aria-label', `${rating.toFixed(1)} out of 5 stars`);
        header.append(identity, score);

        const stars = document.createElement('div');
        stars.className = 'public-feedback-card__stars';
        stars.textContent = starsFor(rating);
        stars.setAttribute('aria-hidden', 'true');

        const quote = document.createElement('blockquote');
        quote.textContent = item.feedback || 'No written feedback was provided.';

        const footer = document.createElement('div');
        footer.className = 'public-feedback-card__footer';
        const type = document.createElement('span');
        type.textContent = TYPE_LABELS[item.type] || 'Rental experience';
        const property = document.createElement('strong');
        property.textContent = item.property_name || 'Verified rental';
        footer.append(type, property);

        card.append(header, stars, quote, footer);
        return card;
    }

    function showFeedbackState(grid, title, message, retry = false) {
        grid.replaceChildren();
        const state = document.createElement('div');
        state.className = 'public-feedback-empty';
        const icon = document.createElement('span');
        icon.className = 'public-feedback-empty__icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = window.domiknowIcon ? window.domiknowIcon('message') : 'i';
        const copy = document.createElement('div');
        const heading = document.createElement('strong');
        heading.textContent = title;
        const text = document.createElement('p');
        text.textContent = message;
        copy.append(heading, text);
        state.append(icon, copy);
        if (retry) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn btn-secondary';
            button.textContent = 'Try again';
            button.addEventListener('click', loadPublicFeedback);
            state.append(button);
        }
        grid.appendChild(state);
    }

    async function loadPublicFeedback() {
        const grid = document.getElementById('publicFeedbackGrid');
        const score = document.getElementById('publicFeedbackScore');
        const stars = document.getElementById('publicFeedbackStars');
        const count = document.getElementById('publicFeedbackCount');
        if (!grid || !score || !stars || !count) return;

        grid.setAttribute('aria-busy', 'true');
        try {
            const response = await fetch('/api/public/feedback?limit=6', { headers: { Accept: 'application/json' } });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Unable to load feedback');
            const feedback = Array.isArray(result.data) ? result.data : [];

            if (!feedback.length) {
                score.textContent = '—';
                stars.textContent = '☆☆☆☆☆';
                count.textContent = 'No public reviews yet';
                showFeedbackState(
                    grid,
                    'Verified feedback will appear here',
                    'There are no lease-connected reviews approved for public display yet. DOMIKNOW does not use fabricated testimonials.'
                );
                return;
            }

            const average = feedback.reduce((sum, item) => sum + clampRating(item.rating), 0) / feedback.length;
            score.textContent = average.toFixed(1);
            stars.textContent = starsFor(average);
            count.textContent = `${feedback.length} verified ${feedback.length === 1 ? 'experience' : 'experiences'} shown`;
            grid.replaceChildren(...feedback.map(createFeedbackCard));
        } catch (error) {
            score.textContent = '—';
            stars.textContent = '☆☆☆☆☆';
            count.textContent = 'Feedback temporarily unavailable';
            showFeedbackState(grid, 'Experiences could not be loaded', 'Please try again. Rental discovery remains available while feedback reconnects.', true);
        } finally {
            grid.setAttribute('aria-busy', 'false');
        }
    }

    function initializeFaq() {
        document.querySelectorAll('.public-faq-item').forEach(item => {
            item.addEventListener('toggle', () => {
                if (!item.open) return;
                document.querySelectorAll('.public-faq-item[open]').forEach(openItem => {
                    if (openItem !== item) openItem.open = false;
                });
            });
        });
    }

    function initialize() {
        loadPublicFeedback();
        initializeFaq();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
}());
