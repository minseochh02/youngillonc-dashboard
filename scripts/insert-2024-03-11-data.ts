#!/usr/bin/env tsx
/**
 * Insert Manually Extracted Data for 2024-03-11
 *
 * Inserts the activities and standups extracted from the dry run
 */

import { insertRows } from '../egdesk-helpers';

const activities = [
  {
    employee_name: '김건우',
    activity_date: '2024-03-11',
    activity_type: 'sales_activity',
    activity_summary: '티케이엘리베이터 보수 Spartan EP 460 공급 건에 대한 내용 정리 및 보고 준비.',
    customer_name: '티케이엘리베이터',
    products_mentioned: JSON.stringify(['Spartan EP 460']),
    confidence_score: 0.90,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({})
  },
  {
    employee_name: '김건우',
    activity_date: '2024-03-11',
    activity_type: 'issue_reported',
    activity_summary: '티케이엘리베이터의 유지보수 계약 상실 및 다른 업체에 의한 경쟁사 제품(omala s2 g 320) 투입 상황을 확인하고 보고함.',
    customer_name: '티케이엘리베이터',
    products_mentioned: JSON.stringify(['omala s2 g 320']),
    confidence_score: 0.95,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({})
  },
  {
    employee_name: '김건우',
    activity_date: '2024-03-11',
    activity_type: 'customer_visit',
    activity_summary: '우신엔지어링 방문 완료.',
    customer_name: '우신엔지어링',
    confidence_score: 0.95,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({}),
    products_mentioned: JSON.stringify([])
  },
  {
    employee_name: '김건우',
    activity_date: '2024-03-11',
    activity_type: 'customer_visit',
    activity_summary: '삼성디스플레이 방문 완료.',
    customer_name: '삼성디스플레이',
    confidence_score: 0.95,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({}),
    products_mentioned: JSON.stringify([])
  },
  {
    employee_name: '김건우',
    activity_date: '2024-03-11',
    activity_type: 'customer_visit',
    activity_summary: '정일제지 방문 완료.',
    customer_name: '정일제지',
    confidence_score: 0.95,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({}),
    products_mentioned: JSON.stringify([])
  },
  {
    employee_name: '김건우',
    activity_date: '2024-03-11',
    activity_type: 'planning',
    activity_summary: '내일 한국지엠 부평 방문을 위해 서울 출근 예정.',
    customer_name: '한국지엠',
    location: '서울',
    next_action: '한국지엠 부평 방문',
    next_action_date: '2024-03-12',
    confidence_score: 0.95,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({}),
    products_mentioned: JSON.stringify([])
  },
  {
    employee_name: '조성래',
    activity_date: '2024-03-11',
    activity_type: 'product_discussion',
    activity_summary: 'TM30B 및 40E 모델을 언급함.',
    products_mentioned: JSON.stringify(['TM30B', '40E']),
    confidence_score: 0.30,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({})
  },
  {
    employee_name: '정현우',
    activity_date: '2024-03-11',
    activity_type: 'other',
    activity_summary: '경기윤활유에서 퇴근했습니다.',
    location: '경기윤활유',
    confidence_score: 1.00,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({}),
    products_mentioned: JSON.stringify([])
  },
  {
    employee_name: '조종복',
    activity_date: '2024-03-11',
    activity_type: 'work_completed',
    activity_summary: '현대일렉트릭에 기어오일 90말을 납품했습니다.',
    customer_name: '현대일렉트릭',
    products_mentioned: JSON.stringify(['기어오일']),
    task_status: 'completed',
    confidence_score: 1.00,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({ quantity: '90말' })
  },
  {
    employee_name: '조종복',
    activity_date: '2024-03-11',
    activity_type: 'sales_activity',
    activity_summary: '현대일렉트릭의 해상용 풍력터빈 프로젝트가 정부 기대치 감소로 육상용으로 전환되어, 6.2MW 베스타스 기종을 강원도에 설치할 예정이며 현재 진행 중입니다.',
    customer_name: '현대일렉트릭',
    location: '강원도',
    next_action: '현대일렉트릭의 육상용 풍력터빈 프로젝트 진행 상황을 지속적으로 모니터링하고 필요한 지원을 제공합니다.',
    confidence_score: 0.90,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({}),
    products_mentioned: JSON.stringify([])
  },
  {
    employee_name: '임재창',
    activity_date: '2024-03-11',
    activity_type: 'planning',
    activity_summary: '내일 선인을 방문할 예정임.',
    customer_name: '선인',
    next_action: '선인 방문',
    next_action_date: '2024-03-12',
    confidence_score: 1.00,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({}),
    products_mentioned: JSON.stringify([])
  },
  {
    employee_name: '조봉건',
    activity_date: '2024-03-11',
    activity_type: 'product_discussion',
    activity_summary: 'MSLA(Mobil Serv Lubricant Analysis) 결과에 대해 고객과 상담을 진행했습니다.',
    confidence_score: 0.90,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({}),
    products_mentioned: JSON.stringify([])
  },
  {
    employee_name: '조봉건',
    activity_date: '2024-03-11',
    activity_type: 'sales_activity',
    activity_summary: '고객 요청에 따라 샘플을 발송했습니다.',
    confidence_score: 0.90,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({}),
    products_mentioned: JSON.stringify([])
  },
  {
    employee_name: '김윤석',
    activity_date: '2024-03-11',
    activity_type: 'sales_activity',
    activity_summary: '외근을 완료했습니다.',
    confidence_score: 0.80,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({}),
    products_mentioned: JSON.stringify([])
  },
  {
    employee_name: '김윤석',
    activity_date: '2024-03-11',
    activity_type: 'other',
    activity_summary: '화성사무소에서 퇴근했습니다.',
    location: '화성사무소',
    confidence_score: 1.00,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({}),
    products_mentioned: JSON.stringify([])
  },
  {
    employee_name: '이승복',
    activity_date: '2024-03-11',
    activity_type: 'other',
    activity_summary: '린데 기흥공장에서 퇴근 보고',
    customer_name: '린데',
    location: '기흥공장',
    confidence_score: 1.00,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({}),
    products_mentioned: JSON.stringify([])
  },
  {
    employee_name: '김중경',
    activity_date: '2024-03-11',
    activity_type: 'sales_activity',
    activity_summary: '외근을 마치고 화성사무소에서 퇴근했습니다.',
    location: '화성사무소',
    confidence_score: 0.95,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({}),
    products_mentioned: JSON.stringify([])
  },
  {
    employee_name: '김중경',
    activity_date: '2024-03-11',
    activity_type: 'customer_visit',
    activity_summary: '내일 현대위아 포승공장 방문 예정입니다.',
    customer_name: '현대위아',
    location: '포승',
    next_action: '현대위아 포승공장 방문',
    next_action_date: '2024-03-12',
    confidence_score: 0.95,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({}),
    products_mentioned: JSON.stringify([])
  },
  {
    employee_name: '김중경',
    activity_date: '2024-03-11',
    activity_type: 'customer_visit',
    activity_summary: '내일 신라정밀 방문 예정입니다.',
    customer_name: '신라정밀',
    next_action: '신라정밀 방문',
    next_action_date: '2024-03-12',
    confidence_score: 0.95,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({}),
    products_mentioned: JSON.stringify([])
  },
  {
    employee_name: '김기진',
    activity_date: '2024-03-11',
    activity_type: 'sales_activity',
    activity_summary: '오늘 외근을 완료하였습니다.',
    confidence_score: 0.85,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({}),
    products_mentioned: JSON.stringify([])
  },
  {
    employee_name: '김기진',
    activity_date: '2024-03-11',
    activity_type: 'other',
    activity_summary: '화성사무소에서 퇴근하였습니다.',
    location: '화성사무소',
    confidence_score: 1.00,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({}),
    products_mentioned: JSON.stringify([])
  },
  {
    employee_name: '김기진',
    activity_date: '2024-03-11',
    activity_type: 'planning',
    activity_summary: '내일 대한루브켐 방문 예정입니다.',
    customer_name: '대한루브켐',
    next_action: '대한루브켐 방문',
    next_action_date: '2024-03-12',
    confidence_score: 1.00,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({}),
    products_mentioned: JSON.stringify([])
  },
  {
    employee_name: '김기진',
    activity_date: '2024-03-11',
    activity_type: 'planning',
    activity_summary: '내일 대동윤활유 방문 예정입니다.',
    customer_name: '대동윤활유',
    next_action: '대동윤활유 방문',
    next_action_date: '2024-03-12',
    confidence_score: 1.00,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({}),
    products_mentioned: JSON.stringify([])
  },
  {
    employee_name: '홍우상',
    activity_date: '2024-03-11',
    activity_type: 'other',
    activity_summary: '화성사무소에서 퇴근 보고',
    location: '화성사무소',
    confidence_score: 1.00,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({}),
    products_mentioned: JSON.stringify([])
  },
  {
    employee_name: '홍우상',
    activity_date: '2024-03-11',
    activity_type: 'planning',
    activity_summary: '내일 MSDS 자료 정리 예정',
    location: '화성사무소',
    next_action: 'MSDS 자료 정리',
    next_action_date: '2024-03-12',
    confidence_score: 1.00,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({}),
    products_mentioned: JSON.stringify([])
  },
  {
    employee_name: '홍우상',
    activity_date: '2024-03-11',
    activity_type: 'planning',
    activity_summary: '내일 유분석 진행 예정',
    location: '화성사무소',
    next_action: '유분석 진행',
    next_action_date: '2024-03-12',
    confidence_score: 1.00,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({}),
    products_mentioned: JSON.stringify([])
  },
  {
    employee_name: '조성호',
    activity_date: '2024-03-11',
    activity_type: 'sales_activity',
    activity_summary: '외근을 수행하였습니다.',
    confidence_score: 1.00,
    extraction_model: 'gemini-2.5-flash',
    activity_details: JSON.stringify({}),
    products_mentioned: JSON.stringify([])
  }
];

const standups = [
  {
    employee_name: '김건우',
    report_date: '2024-03-11',
    completed_today: JSON.stringify([
      { task: '티케이엘리베이터 Spartan EP 460 공급 건 내용 정리 및 보고 준비', customer: '티케이엘리베이터' },
      { task: '티케이엘리베이터 유지보수 계약 상실 및 경쟁사 제품(omala s2 g 320) 투입 상황 확인 및 보고', customer: '티케이엘리베이터' },
      { task: '고객 방문', customer: '우신엔지어링' }
    ]),
    planned_tasks: JSON.stringify([
      { task: '한국지엠 부평 방문', customer: '한국지엠 부평' }
    ]),
    customers_visited: JSON.stringify(['우신엔지어링', '삼성디스플레이', '정일제지']),
    confidence_score: 0.95
  },
  {
    employee_name: '정현우',
    report_date: '2024-03-11',
    checkout_location: '경기윤활유',
    confidence_score: 1.00,
    completed_today: JSON.stringify([]),
    planned_tasks: JSON.stringify([]),
    customers_visited: JSON.stringify([])
  },
  {
    employee_name: '조종복',
    report_date: '2024-03-11',
    completed_today: JSON.stringify([
      { task: '기어오일 90말 납품', customer: '현대일렉트릭' }
    ]),
    planned_tasks: JSON.stringify([
      { task: '현대일렉트릭 육상용 풍력터빈 프로젝트 진행 상황 모니터링 및 지원', customer: '현대일렉트릭' }
    ]),
    customers_visited: JSON.stringify(['현대일렉트릭']),
    confidence_score: 0.95
  },
  {
    employee_name: '임재창',
    report_date: '2024-03-11',
    checkout_location: '신신화학공업',
    completed_today: JSON.stringify([
      { task: '신신화학공업에서 업무 완료 및 퇴근', customer: '신신화학공업' }
    ]),
    planned_tasks: JSON.stringify([
      { task: '선인 방문', customer: '선인' }
    ]),
    customers_visited: JSON.stringify(['신신화학공업']),
    confidence_score: 1.00
  },
  {
    employee_name: '조봉건',
    report_date: '2024-03-11',
    completed_today: JSON.stringify([
      { task: 'MSLA 결과 상담' },
      { task: '샘플 발송' }
    ]),
    confidence_score: 0.80,
    planned_tasks: JSON.stringify([]),
    customers_visited: JSON.stringify([])
  },
  {
    employee_name: '김윤석',
    report_date: '2024-03-11',
    checkout_location: '화성사무소',
    completed_today: JSON.stringify([
      { task: '외근 수행' }
    ]),
    confidence_score: 0.90,
    planned_tasks: JSON.stringify([]),
    customers_visited: JSON.stringify([])
  },
  {
    employee_name: '이승복',
    report_date: '2024-03-11',
    checkout_location: '린데 기흥공장',
    customers_visited: JSON.stringify(['린데']),
    confidence_score: 1.00,
    completed_today: JSON.stringify([]),
    planned_tasks: JSON.stringify([])
  },
  {
    employee_name: '김중경',
    report_date: '2024-03-11',
    checkout_location: '화성사무소',
    completed_today: JSON.stringify([
      { task: '외근 완료' }
    ]),
    planned_tasks: JSON.stringify([
      { task: '고객사 방문', customer: '현대위아 포승공장' },
      { task: '고객사 방문', customer: '신라정밀' }
    ]),
    confidence_score: 0.95,
    customers_visited: JSON.stringify([])
  },
  {
    employee_name: '김기진',
    report_date: '2024-03-11',
    checkout_location: '화성사무소',
    completed_today: JSON.stringify([
      { task: '외근' }
    ]),
    planned_tasks: JSON.stringify([
      { task: '고객 방문', customer: '대한루브켐' },
      { task: '고객 방문', customer: '대동윤활유' }
    ]),
    confidence_score: 0.95,
    customers_visited: JSON.stringify([])
  },
  {
    employee_name: '홍우상',
    report_date: '2024-03-11',
    checkout_location: '화성사무소',
    planned_tasks: JSON.stringify([
      { task: 'MSDS 자료 정리' },
      { task: '유분석 진행' }
    ]),
    confidence_score: 1.00,
    completed_today: JSON.stringify([]),
    customers_visited: JSON.stringify([])
  },
  {
    employee_name: '조성호',
    report_date: '2024-03-11',
    checkout_location: '서울사무실',
    completed_today: JSON.stringify([
      { task: '외근' }
    ]),
    confidence_score: 1.00,
    planned_tasks: JSON.stringify([]),
    customers_visited: JSON.stringify([])
  }
];

async function main() {
  console.log('💾 Inserting extracted data for 2024-03-11\n');

  // Insert activities
  console.log(`📋 Inserting ${activities.length} activities...`);
  try {
    await insertRows('employee_activity_log', activities);
    console.log(`✅ Inserted ${activities.length} activities into employee_activity_log`);
  } catch (error: any) {
    console.error(`❌ Error inserting activities:`, error.message);
  }

  console.log();

  // Insert standups
  console.log(`📊 Inserting ${standups.length} daily standups...`);
  try {
    await insertRows('daily_standup_log', standups);
    console.log(`✅ Inserted ${standups.length} standups into daily_standup_log`);
  } catch (error: any) {
    console.error(`❌ Error inserting standups:`, error.message);
  }

  console.log('\n✅ Data insertion complete!');
  console.log('\n📝 To verify, run:');
  console.log('   npx tsx scripts/view-extracted-activities.ts 2024-03-11');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
