# Reflection
The hardest part for me was keeping authentication state consistent between the browser and the API.
I had to handle missing and expired JWTs without leaving the user on a broken dashboard.
I also spent time making create, update and delete actions update the interface clearly.
Adding isolated API tests helped me verify the protected routes without changing real library data.
This project taught me to treat loading, error and empty states as part of the feature, not optional polish.
