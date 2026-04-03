// Query employee_category via the API
async function queryEmployeeCategory() {
  try {
    const response = await fetch('http://localhost:3000/api/dashboard/data-management?table=employee_category');
    const data = await response.json();

    if (data.success) {
      console.log(JSON.stringify(data.data, null, 2));
    } else {
      console.error('Error:', data.error);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

queryEmployeeCategory();
