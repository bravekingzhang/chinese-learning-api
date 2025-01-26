#!/bin/bash

# 定义应用名称
APP_NAME="chinese-learning-api"

# 显示帮助信息
show_help() {
    echo "Usage: $0 {start|restart|stop|status}"
    echo "  start   - Start the application with PM2"
    echo "  restart - Restart the application"
    echo "  stop    - Stop and delete the application"
    echo "  status  - Show application status"
    exit 1
}

# 检查命令行参数
if [ $# -ne 1 ]; then
    show_help
fi

# 根据参数执行相应操作
case "$1" in
    start)
        echo "Starting $APP_NAME..."
        NODE_ENV=production pm2 start src/server.js --name $APP_NAME
        ;;
    restart)
        echo "Restarting $APP_NAME..."
        pm2 restart $APP_NAME
        ;;
    stop)
        echo "Stopping $APP_NAME..."
        pm2 delete $APP_NAME
        ;;
    status)
        echo "Showing status for $APP_NAME..."
        pm2 show $APP_NAME
        ;;
    *)
        show_help
        ;;
esac

# 显示 PM2 进程列表
echo "\nCurrent PM2 processes:"
pm2 list