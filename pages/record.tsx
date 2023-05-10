import { useState } from 'react';
import { invoke } from "@tauri-apps/api/tauri"
import Link from 'next/link'

import record_styles from '../styles/ClinicalCodeComp.module.css'
import styles from '../styles/Category.module.css'

interface EventCount {
    name: string,
    count: integer,
}

interface Events {
    before: EventCount[],
    after: EventCount[],
}

interface Timestamp {
    timestamp: integer;
    readable: string;
}

interface ClinicalCode {
    name: string
    docs: string
    groups: string[]
}

function get_event_counts(events, name) {
    if (name in events) {
	return events[name]
    } else {
	return []
    }
}

function EventCountBlock({ event_count_list }: { EventCount }) {
    return <div>
	{event_count_list.map(event_count =>
	    <div><b>{event_count.count}</b> {event_count.name}</div>)}
    </div>
}

function EventCountComp({ events }: { Events }) {
    return <div className = {record_styles.event_count}>
	<b>Event Counts</b>
	<div>
	    <div className ={record_styles.side_by_side}>
		<b>Before</b>
		<EventCountBlock event_count_list={get_event_counts(events, "before")} />
	    </div>

	    <div className ={record_styles.side_by_side}>
		<b>After</b>
		<EventCountBlock event_count_list={get_event_counts(events, "after")} />	
	    </div>
	    </div>
	</div>
}

function clinical_code_groups(clinical_code) {
    if ("groups" in clinical_code) {
	return clinical_code.groups
    } else {
	return []
    }
}

function clinical_code_contains_group(clinical_code: ClinicalCode, group) {
    return clinical_code_groups(clinical_code).includes(group)
}

function ClinicalCodeComp({ clinical_code }: { ClinicalCode }) {

    return <div>
	<span><b>{clinical_code.name}</b></span>
	<span>{clinical_code.docs}</span>
	{
	    clinical_code_groups(clinical_code).map(group =>
		<span className={record_styles.clinical_code_group}>
		    {group}
		</span>)
	}
    </div>
}

interface Mortality {
    alive: boolean
    date_of_death: Timestamp
    cause_of_death: ClinicalCode
}

interface Episode {
    start_date: Timestamp,
    end_date: Timestamp,
    primary_diagnosis: ClinicalCode,
    primary_procedure: ClinicalCode,
    secondary_diagnoses: ClinicalCode[],
    secondary_procedures: ClinicalCode[],
}

function get_primary_clinical_code(episode: Episode, name: string) {
    if (name in episode) {
	return <ClinicalCodeComp clinical_code ={episode[name]} />
    } else {
	return <>
	    None
	</>
    }
}


function get_secondary_clinical_codes(episode: Episode, name: string) {
    if (name in episode) {
	return <div>{episode[name].map(clinical_code => <div>
	    <ClinicalCodeComp clinical_code ={clinical_code} />
	</div>
	    )}
	</div>
    } else {
	return <>
	    None
	</>
    }    
}

function episode_contains_clinical_code_group_anywhere(episode, group) {
    if ("primary_diagnosis" in episode) {
	if (clinical_code_contains_group(episode.primary_diagnosis, group)) {
	    return true
	}
    }

    if ("primary_procedure" in episode) {
	if (clinical_code_contains_group(episode.primary_procedure, group)) {
	    return true
	}
    }

    if ("secondary_diagnoses" in episode) {
	const found_group = episode
	    .secondary_diagnoses
	    .some(function(code) {
		return clinical_code_contains_group(code, group)
	    })
	if (found_group) {
	    return true
	}
    }

    if ("secondary_procedures" in episode) {
	const found_group = episode
	    .secondary_procedures
	    .some(function(code) {
		return clinical_code_contains_group(code, group)
	    })
	if (found_group) {
	    return true
	}
    }
    return false
}

function ClinicalCodesBlock({ episode, diagnosis }: { Episode, boolean }) {

    let block_title = "Procedures"
    let primary_name = "primary_procedure"
    let secondary_name = "secondary_procedure"
    if (diagnosis) {
	block_title = "Diagnoses"
	primary_name = "primary_diagnosis"
	secondary_name = "secondary_diagnoses"	
    }
    
    return <div className = {record_styles.clinical_codes_block}>
	<b>{block_title}</b>
	<div>{get_primary_clinical_code(episode, primary_name)} </div>
	<hr/>
	<div>{get_secondary_clinical_codes(episode, secondary_name)} </div>	
    </div>
}

function DiagnosisBlock({ episode }: { Episode }) {
    return <ClinicalCodesBlock episode={episode} diagnosis = {true} />
}

function ProcedureBlock({ episode }: { Episode }) {
    return <ClinicalCodesBlock episode={episode} diagnosis = {false} />
}

function EpisodeComp({ episode }: { Episode }) {
    return <div className ={record_styles.episode}>
	<div>Episode start: <Date timestamp ={episode.start_date} /></div>
	<div>Episode end: <Date timestamp ={episode.end_date} /></div>
	<div>
	    <DiagnosisBlock episode={episode} />
	    <ProcedureBlock episode={episode} />
	</div>
    </div>
}

interface Spell {
    id: string,
    start_date: Timestamp,
    end_date: Timestamp,
    episodes: Episodes[],
}

function SpellComp({ spell }: { Spell }) {
    return <div className ={record_styles.spell}>
	<div>Spell id: {spell.id}</div>
	<div>Spell start: <Date timestamp ={spell.start_date} /></div>
	<div>Spell end: <Date timestamp ={spell.end_date} /></div>
	<div>Contains: {spell_contains_clinical_code_group_anywhere(spell, "acs_nstemi")}</div>
	<b>Episodes</b>
	{spell.episodes.map(episode => <div>
	    <EpisodeComp episode = {episode} />
	</div>)}
    </div>
}

function Date({ timestamp }: { Timestamp }) {
    return <span>
	{timestamp.readable}
    </span>
}

interface AcsRecord {
    nhs_number: string,
    age_at_index: integer,
    date_of_index: Timestamp,
    presentation: string,
    index_spell: Spell,
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

function get_optional_array(record, key) {
    if (key in record) {
	return record[key]
    } else {
	return []
    }
}

function AcsRecordComp({ record } : { AcsRecord }) {
    return <div  className ={record_styles.record}>
	<PatientInfo record = {record} />
	<Mortality mortality = {record.mortality} />
	<EventCountComp events ={record.event_counts} />
	<b>Index Spell</b>
	<SpellComp spell = {record.index_spell} />
	<b>Spells after</b>
	<div> {
	    get_optional_array(record, "spells_after").map(spell =>
		<SpellComp spell = {spell} />
	    )
	} </div>
	<b>Spells before</b>
	<div> {
	    get_optional_array(record, "spells_before").map(spell =>
		<SpellComp spell = {spell} />
	    )
	} </div>

    </div>
}

function spell_contains_clinical_code_group_anywhere(spell, group) {
    return spell.episodes.some(function(episode) {
	return episode_contains_clinical_code_group_anywhere(episode, group)
    })
}

function record_contains_clinical_code_group_anywhere(record, group) {
    if (spell_contains_clinical_code_group_anywhere(record.index_spell,
						    group)) {
	return true
    }

    let found = get_optional_array(record, "spells_after")
	.some(function(spell) {
	    return spell_contains_clinical_code_group_anywhere(spell, group)
	})
    if (found) {
	return true
    }

    found = get_optional_array(record, "spells_before")
	.some(function(spell) {
	    return spell_contains_clinical_code_group_anywhere(spell, group)
	})
    if (found) {
	return true
    }

    return false
}

export default function Home() {

    let [acs_records, setAcsRecords] = useState<AcsRecord[]>([]);
    
    const [searchTerm, setSearchTerm] = useState('');

    const handleChange = event => {
	setSearchTerm(event.target.value);
    };
    
    // Function to load the codes yaml file
    function load_file() {
        invoke('get_yaml')
	    .then((result) => {

		// From rust
		let acs_records: AcsRecord[] = JSON.parse(result as string);
		setAcsRecords(acs_records);
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

	const searched_records = acs_records.filter(function(record) {

	    if (searchTerm == "") {
		return true;
	    }
	    
	    const clinical_code_groups = searchTerm.split(/[ ,]+/)
	    return clinical_code_groups.every(function(group) {
		return record_contains_clinical_code_group_anywhere(record,
								    group)
	    })
	});
	
	return <div>
	    <label htmlFor="search">Search: </label>
	    <input id="search" type="text" onChange={handleChange}/>
	    <p>
		Searching for <strong>{searchTerm}</strong>.
	    </p>
	    <hr />
	    {searched_records.map(record => <AcsRecordComp record = {record}
				       />)   
	    } </div>
    }
}
