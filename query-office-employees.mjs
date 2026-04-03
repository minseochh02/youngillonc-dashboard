// Query employee_category via the API for office employees
async function queryOfficeEmployees() {
  try {
    const response = await fetch('http://localhost:3000/api/dashboard/data-management?table=employee_category');
    const data = await response.json();

    if (data.success) {
      // Filter for office and 남부지사 employees
      const officeEmployees = data.data.filter(emp =>
        emp.담당자?.includes('사무실') ||
        emp.담당자?.includes('남부지사') ||
        emp.b2c_팀?.includes('사무실')
      );

      console.log('Office Employees:');
      console.log('='.repeat(80));
      officeEmployees.forEach(emp => {
        console.log(`전체사업소: ${emp.전체사업소 || 'N/A'}`);
        console.log(`b2c_팀: ${emp.b2c_팀 || 'N/A'}`);
        console.log(`담당자: ${emp.담당자 || 'N/A'}`);
        console.log(`b2b팀: ${emp.b2b팀 || 'N/A'}`);
        console.log('-'.repeat(80));
      });
      console.log(`Total: ${officeEmployees.length} employees`);
    } else {
      console.error('Error:', data.error);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

queryOfficeEmployees();
