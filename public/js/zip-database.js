// ZIP code database with major US cities
const zipDatabase = {
    '63017': {
        city: 'Chesterfield',
        state: 'MO'
    },
    '63141': {
        city: 'St. Louis',
        state: 'MO'
    },
    '63105': {
        city: 'Clayton',
        state: 'MO'
    },
    '63131': {
        city: 'Town and Country',
        state: 'MO'
    },
    '63124': {
        city: 'Ladue',
        state: 'MO'
    },
    '63144': {
        city: 'Brentwood',
        state: 'MO'
    },
    '63117': {
        city: 'Richmond Heights',
        state: 'MO'
    },
    '63119': {
        city: 'Webster Groves',
        state: 'MO'
    },
    '63122': {
        city: 'Kirkwood',
        state: 'MO'
    },
    '63021': {
        city: 'Ballwin',
        state: 'MO'
    }
};

// ZIP lookup utility
window.zipLookup = {
    lookup(zip) {
        const data = zipDatabase[zip];
        if (!data) {
            console.log('ZIP code not found in local database:', zip);
            return null;
        }
        return {
            zip: zip,
            city: data.city,
            state: data.state
        };
    }
}; 