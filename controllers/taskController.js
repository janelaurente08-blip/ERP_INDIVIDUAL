/*
    MIT License

    Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
    Mindoro State University - Philippines

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
    */
    import Task from "../models/Task.js";
  import Worker from "../models/Worker.js";

  export const tasksPage = async (req, res) => {
    try {
      const tasks = await Task.findAll({
        order: [["createdAt", "DESC"]],
      });

      const workers = await Worker.findAll({
        order: [["name", "ASC"]],
      });

      res.render("tasks", {
        title: "Manage Tasks",
        tasks,
        workers,
      });
    } catch (error) {
      console.error(error);
      res.status(500).send("Could not load tasks.");
    }
  };

  export const createTask = async (req, res) => {
    try {
      const { title, description, assignedWorkerId, dueDate, status } = req.body;

      if (!title?.trim()) {
        return res.status(400).send("Task title is required.");
      }

      await Task.create({
        title: title.trim(),
        description: description?.trim() || null,
        assignedWorkerId: assignedWorkerId || null,
        dueDate: dueDate || null,
        status: status || "Pending",
      });

      res.redirect("/tasks");
    } catch (error) {
      console.error(error);
      res.status(500).send("Could not create task.");
    }
  };
