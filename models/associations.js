import Worker from './Worker.js';
import Task from './Task.js';
import Attendance from './Attendance.js';

Worker.hasMany(Task, {
    foreignKey: 'workerId',
    onDelete: 'CASCADE'
});

Task.belongsTo(Worker, {
    foreignKey: 'workerId'
});

Worker.hasMany(Attendance, {
    foreignKey: 'workerId',
    onDelete: 'CASCADE'
});

Attendance.belongsTo(Worker, {
    foreignKey: 'workerId'
});

export {
    Worker,
    Task,
    Attendance
};
