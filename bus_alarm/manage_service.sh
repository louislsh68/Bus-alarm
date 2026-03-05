#!/bin/bash

# Bus Alarm Service Management Script

SERVICE_NAME="bus-alarm"
WORK_DIR="/Users/clawd/.openclaw/workspace/bus_alarm"

case "$1" in
  start)
    echo "Starting Bus Alarm Service..."
    cd $WORK_DIR && npm start &
    echo $! > $WORK_DIR/service.pid
    echo "Bus Alarm Service started with PID $(cat $WORK_DIR/service.pid)"
    ;;
    
  stop)
    if [ -f $WORK_DIR/service.pid ]; then
      PID=$(cat $WORK_DIR/service.pid)
      echo "Stopping Bus Alarm Service (PID: $PID)..."
      kill $PID
      rm $WORK_DIR/service.pid
      echo "Bus Alarm Service stopped."
    else
      echo "Service is not running or PID file not found."
    fi
    ;;
    
  restart)
    $0 stop
    sleep 2
    $0 start
    ;;
    
  status)
    if [ -f $WORK_DIR/service.pid ]; then
      PID=$(cat $WORK_DIR/service.pid)
      if ps -p $PID > /dev/null; then
        echo "Bus Alarm Service is running (PID: $PID)"
      else
        echo "PID file exists but process is not running."
        rm $WORK_DIR/service.pid
      fi
    else
      echo "Bus Alarm Service is not running."
    fi
    ;;
    
  *)
    echo "Usage: $0 {start|stop|restart|status}"
    exit 1
    ;;
esac

exit 0