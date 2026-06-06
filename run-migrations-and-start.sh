#!/bin/bash

echo "Running database migrations..."
npm run migrate

if [ $? -eq 0 ]; then
    echo "Migrations completed successfully"
    echo "Starting application..."
    npm start
else
    echo "Migration failed!"
    exit 1
fi
