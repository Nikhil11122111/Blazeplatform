// ZIP code lookup functionality
document.addEventListener('DOMContentLoaded', function() {
    // Get input elements
    const zipInput = document.querySelector('input[name="zipCode"]');
    const stateInput = document.querySelector('input[name="state"]');
    const cityInput = document.querySelector('input[name="city"]');

    if (zipInput) {
        console.log('ZIP input found, setting up listeners');
        
        // Load ZIP code data
        let zipData = null;
        let zipDataLoaded = false;
        
        console.log('Loading ZIP code data...');
        fetch('/assets/api/georef-united-states-of-america-zc-point@public.json')
            .then(response => {
                console.log('ZIP data fetch response:', response.status);
                if (!response.ok) {
                    throw new Error(`Failed to load ZIP code data: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                zipData = data;
                zipDataLoaded = true;
                console.log('ZIP data loaded successfully, records:', zipData.length);
                
                // Check for initial value
                if (zipInput.value.trim().length === 5) {
                    handleZipLookup(zipInput.value.trim());
                }
            })
            .catch(error => {
                console.error('Error loading ZIP data:', error);
            });
        
        // Function to handle ZIP lookup
        function handleZipLookup(zip) {
            console.log('Looking up ZIP:', zip);
            if (!zip || zip.length !== 5 || !zipDataLoaded) return;

            try {
                // Find matching ZIP code
                const zipInfo = zipData.find(record => record.zip_code === zip);
                console.log('ZIP lookup result:', zipInfo);
                
                if (zipInfo) {
                    // Update state
                    if (stateInput) {
                        stateInput.value = zipInfo.ste_name || '';
                        // Trigger change event
                        stateInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    
                    // Update city
                    if (cityInput) {
                        cityInput.value = zipInfo.usps_city || '';
                        // Trigger change event
                        cityInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    
                    console.log('Updated fields:', {
                        state: stateInput.value,
                        city: cityInput.value
                    });
                } else {
                    console.log('ZIP code not found in data');
                    if (stateInput) stateInput.value = '';
                    if (cityInput) cityInput.value = '';
                }
            } catch (error) {
                console.error('Error processing ZIP lookup:', error);
            }
        }

        // Handle input event (as user types)
        zipInput.addEventListener('input', function() {
            // Remove any non-numeric characters
            this.value = this.value.replace(/\D/g, '');
            const zip = this.value.trim();
            
            // Clear state and city if ZIP is not 5 digits
            if (zip.length !== 5) {
                if (stateInput) stateInput.value = '';
                if (cityInput) cityInput.value = '';
                return;
            }
            
            if (zipDataLoaded) {
                handleZipLookup(zip);
            } else {
                console.log('ZIP data not yet loaded, will retry when data is available');
            }
        });

        // Handle change event (for paste, autofill, etc.)
        zipInput.addEventListener('change', function() {
            const zip = this.value.trim();
            if (zip.length === 5 && zipDataLoaded) {
                handleZipLookup(zip);
            }
        });
    } else {
        console.warn('ZIP input field not found');
    }
}); 