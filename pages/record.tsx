import { useState } from 'react';
import { invoke } from "@tauri-apps/api/tauri"
import Link from 'next/link'

import styles from '../styles/ClinicalCodeComp.module.css'

interface Timestamp {
    timestamp: integer;
    readable: string;
}

interface ClinicalCode {
    name: string
    docs: string
    groups: string[]
}

interface Mortality {
    alive: boolean
    date_of_death: Timestamp
    cause_of_death: ClinicalCode
}

interface AcsRecord {
    nhs_number: integer;
    age_at_index: integer;
    date_of_index: Timestamp;
    presentation: string;
}

function Date({ timestamp }: { Timestamp }) {
    return <span>
    {timestamp.readable}
    </span>
}

function PatientInfo({ record }: { AcsRecord }) {
    return <div>
	<b>Patient Information</b>
	<div>NHS number: {record.nhs_number}</div>
	<div>Age at index: {record.age_at_index}</div>
	<div>Date of index: <Date timestamp = {record.date_of_index}/></div>
	<div>Presentation: {record.presentation}</div>
	<div>Inclusion trigger: {record.inclusion_trigger}</div>
    </div>
}

function ClinicalCodeComp({ clinical_code }: { ClinicalCode }) {
    return <span>
	<span><b>{clinical_code.name}</b></span>
	<span>{clinical_code.docs}</span> {
	    clinical_code.groups.map(group =>
		<span className={styles.clinical_code_group}>
		    {group}
		</span>)
	} </span>
}

function Mortality({ mortality }: { Mortality }) {

    let alive = "Alive"
    if (mortality.alive) {
	return <div>
	    <b>Mortality</b>: Alive
	</div>
    } else {
	return <div>
	    <b>Mortality</b>:
	       <div>Date of death:
		   <div><Date timestamp = {mortality.date_of_death} /></div>
		   <div><ClinicalCodeComp clinical_code ={mortality.cause_of_death} /></div>
	       </div>
	</div>
    }
}

export default function Home() {

    let [acs_records, setAcsRecords] = useState<AcsRecord[]>([]);

    // Function to load the codes yaml file
    function load_file() {
        invoke('get_yaml')
	    .then((result) => {

		// From rust
		let acs_records: AcsRecord[] = JSON.parse(result as string);
		setAcsRecords(acs_records);
		console.log(result);
	    })
    }

    if (acs_records.length == 0) {
	return <div>
            <h1>Patient ACS/PCI Record Viewer</h1>
	    <p className={styles.info}>Load a records file.</p>
	    <div>
		<span className={styles.button}
		      onClick={load_file}>Load file</span>
		<Link className={styles.button} href="/">Back</Link>
	    </div>
	</div>
    } else {
	return <div> {
	    acs_records.map(record => <div>
		<PatientInfo record = {record} />
		<Mortality mortality = {record.mortality} />
	    </div>)
	} </div>

    }
}
