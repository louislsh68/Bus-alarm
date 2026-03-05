#!/bin/bash
# Script to run the Bus Alarm system

echo "Starting Bus Alarm System..."
echo "Route: $BUS_ROUTE, Stop: $STOP_CODE, Direction: $DIRECTION"

# Set default values if not provided
export BUS_ROUTE=${BUS_ROUTE:-960}
export STOP_CODE=${STOP_CODE:-461}
export DIRECTION=${DIRECTION:-O}
export PORT=${PORT:-3000}

node index.js